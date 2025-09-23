"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { LightningDestinationConfig, LnurlPayParams } from "../lightning";
import * as lightning from "../lightning";

export type ZapStatus = "idle" | "loading" | "paying" | "error";

export type ZapWorkflowOptions = {
  lightningAddress?: string | null;
  lnurl?: string | null;
  comment?: string;
};

type BaseState = {
  lightningAddress: string | null;
  lnurl: string | null;
  comment?: string;
  hasDestination: boolean;
  isMenuOpen: boolean;
  status: ZapStatus;
  errorMessage: string | null;
  payParams: LnurlPayParams | null;
  showSuccess: boolean;
  lastZapAmount: number | null;
  amountWasClamped: boolean;
};

type Listener = () => void;

type ZapWorkflowView = {
  hasDestination: boolean;
  isMenuOpen: boolean;
  status: ZapStatus;
  errorMessage: string | null;
  payParams: LnurlPayParams | null;
  showSuccess: boolean;
  lastZapAmount: number | null;
  amountWasClamped: boolean;
  isLoading: boolean;
  minSats: number | null;
  maxSats: number | null;
  toggleMenu: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  sendZap: (amount: number) => Promise<void>;
  isAmountAllowed: (amount: number) => boolean;
  reportError: (message: string) => void;
};

export type ZapWorkflowController = {
  readonly view: ZapWorkflowView;
  updateOptions: (options: ZapWorkflowOptions) => void;
  ensurePayParamsLoaded: () => Promise<void>;
  subscribe: (listener: Listener) => () => void;
  dispose: () => void;
};

const SUCCESS_TIMEOUT_MS = 4000;

function normalizeDestination(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function computeHasDestination(options: ZapWorkflowOptions): boolean {
  return Boolean(options.lightningAddress?.trim()) || Boolean(options.lnurl?.trim());
}

class ZapWorkflowControllerImpl implements ZapWorkflowController {
  private state: BaseState;

  private currentView: ZapWorkflowView;

  private readonly listeners = new Set<Listener>();

  private successTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingPayParams: Promise<LnurlPayParams | null> | null = null;

  private readonly toggleMenuHandler = () => {
    if (!this.state.hasDestination) {
      return;
    }
    if (this.state.isMenuOpen) {
      this.closeMenuHandler();
    } else {
      this.openMenuHandler();
    }
  };

  private readonly openMenuHandler = () => {
    if (!this.state.hasDestination) {
      return;
    }
    this.mutate((draft) => {
      draft.errorMessage = null;
      draft.showSuccess = false;
      draft.isMenuOpen = true;
    });
    void this.ensurePayParamsLoaded();
  };

  private readonly closeMenuHandler = () => {
    if (!this.state.isMenuOpen) {
      return;
    }
    this.mutate((draft) => {
      draft.isMenuOpen = false;
    });
  };

  private readonly reportErrorHandler = (message: string) => {
    this.clearSuccessTimer();
    this.mutate((draft) => {
      draft.status = "error";
      draft.errorMessage = message;
      draft.showSuccess = false;
    });
  };

  private readonly sendZapHandler = async (requestedAmount: number) => {
    if (!this.state.hasDestination) {
      return;
    }

    const params = this.state.payParams ?? (await this.ensurePayParamsLoaded());
    if (!params) {
      return;
    }

    try {
      this.mutate((draft) => {
        draft.status = "paying";
        draft.errorMessage = null;
        draft.showSuccess = false;
        draft.amountWasClamped = false;
      });

      const normalizedAmount = lightning.clampZapAmount(requestedAmount, params);
      const invoice = await lightning.requestLnurlInvoice(
        params,
        normalizedAmount,
        this.state.comment,
      );

      let wasPaidThroughWebln = false;
      if (lightning.isWeblnAvailable()) {
        try {
          await lightning.payWithWebln(invoice.pr);
          wasPaidThroughWebln = true;
        } catch (error) {
          console.warn("WebLN payment failed, falling back to lightning link.", error);
        }
      }

      if (!wasPaidThroughWebln) {
        lightning.openLightningInvoice(invoice.pr);
      }

      this.clearSuccessTimer();
      this.mutate((draft) => {
        draft.lastZapAmount = normalizedAmount;
        draft.amountWasClamped = normalizedAmount !== requestedAmount;
        draft.showSuccess = true;
        draft.isMenuOpen = false;
        draft.status = "idle";
      });
      this.scheduleSuccessHide();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send zap.";
      this.reportErrorHandler(message);
    }
  };

  private readonly isAmountAllowedHandler = (amount: number) => this.isAmountAllowed(amount);

  constructor(options: ZapWorkflowOptions) {
    this.state = {
      lightningAddress: normalizeDestination(options.lightningAddress),
      lnurl: normalizeDestination(options.lnurl),
      comment: options.comment,
      hasDestination: computeHasDestination(options),
      isMenuOpen: false,
      status: "idle",
      errorMessage: null,
      payParams: null,
      showSuccess: false,
      lastZapAmount: null,
      amountWasClamped: false,
    };
    this.currentView = this.buildView();
  }

  get view(): ZapWorkflowView {
    return this.currentView;
  }

  updateOptions(options: ZapWorkflowOptions): void {
    const nextLightning = normalizeDestination(options.lightningAddress);
    const nextLnurl = normalizeDestination(options.lnurl);
    const nextComment = options.comment;
    const hasDestination = Boolean(nextLightning) || Boolean(nextLnurl);

    this.mutate((draft) => {
      draft.lightningAddress = nextLightning;
      draft.lnurl = nextLnurl;
      draft.comment = nextComment;
      draft.hasDestination = hasDestination;
      draft.payParams = null;
      if (!hasDestination) {
        draft.isMenuOpen = false;
      }
    });
  }

  async ensurePayParamsLoaded(): Promise<void> {
    if (!this.state.hasDestination) {
      return;
    }
    if (this.state.payParams) {
      return;
    }
    if (this.pendingPayParams) {
      await this.pendingPayParams;
      return;
    }
    this.pendingPayParams = this.loadPayParams();
    try {
      await this.pendingPayParams;
    } finally {
      this.pendingPayParams = null;
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.clearSuccessTimer();
    this.listeners.clear();
    this.pendingPayParams = null;
  }

  private mutate(updater: (draft: BaseState) => void): void {
    updater(this.state);
    this.refreshView();
  }

  private refreshView(): void {
    this.currentView = this.buildView();
    this.emit();
  }

  private buildView(): ZapWorkflowView {
    const { payParams, status } = this.state;
    const minSats = payParams ? Math.ceil(payParams.minSendable / 1000) : null;
    const maxSats = payParams ? Math.floor(payParams.maxSendable / 1000) : null;
    const isLoading = status === "loading" || status === "paying";

    return {
      hasDestination: this.state.hasDestination,
      isMenuOpen: this.state.isMenuOpen,
      status: this.state.status,
      errorMessage: this.state.errorMessage,
      payParams: this.state.payParams,
      showSuccess: this.state.showSuccess,
      lastZapAmount: this.state.lastZapAmount,
      amountWasClamped: this.state.amountWasClamped,
      isLoading,
      minSats,
      maxSats,
      toggleMenu: this.toggleMenuHandler,
      openMenu: this.openMenuHandler,
      closeMenu: this.closeMenuHandler,
      sendZap: this.sendZapHandler,
      isAmountAllowed: this.isAmountAllowedHandler,
      reportError: this.reportErrorHandler,
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private buildDestinationConfig(): LightningDestinationConfig {
    return {
      lightningAddress: this.state.lightningAddress ?? undefined,
      lnurl: this.state.lnurl ?? undefined,
    };
  }

  private async loadPayParams(): Promise<LnurlPayParams | null> {
    this.mutate((draft) => {
      draft.status = "loading";
      draft.errorMessage = null;
      draft.showSuccess = false;
    });

    try {
      const endpoint = lightning.resolveLightningPayEndpoint(this.buildDestinationConfig());
      const params = await lightning.fetchLnurlPayParams(endpoint);
      this.mutate((draft) => {
        draft.payParams = params;
        draft.status = "idle";
      });
      return params;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load zap configuration.";
      this.mutate((draft) => {
        draft.status = "error";
        draft.errorMessage = message;
        draft.showSuccess = false;
      });
      return null;
    }
  }

  private isAmountAllowed(amount: number): boolean {
    const params = this.state.payParams;
    if (!params) {
      return true;
    }
    const minSats = params.minSendable / 1000;
    const maxSats = params.maxSendable / 1000;
    return amount >= minSats && amount <= maxSats;
  }

  private scheduleSuccessHide(): void {
    this.clearSuccessTimer();
    this.successTimer = setTimeout(() => {
      this.mutate((draft) => {
        draft.showSuccess = false;
      });
    }, SUCCESS_TIMEOUT_MS);
  }

  private clearSuccessTimer(): void {
    if (this.successTimer !== null) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  }
}

export function createZapWorkflowController(options: ZapWorkflowOptions): ZapWorkflowController {
  return new ZapWorkflowControllerImpl(options);
}

export function useZapWorkflow(options: ZapWorkflowOptions): ZapWorkflowView {
  const normalizedOptions = useMemo(() => ({ ...options }), [options]);
  const controllerRef = useRef<ZapWorkflowController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createZapWorkflowController(normalizedOptions);
  }
  const controller = controllerRef.current;

  useEffect(() => {
    controller.updateOptions(normalizedOptions);
  }, [controller, normalizedOptions]);

  const [, setVersion] = useState(0);
  useEffect(() => controller.subscribe(() => setVersion((value) => value + 1)), [controller]);

  useEffect(() => () => controller.dispose(), [controller]);

  const { isMenuOpen, closeMenu } = controller.view;

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [closeMenu, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    void controller.ensurePayParamsLoaded();
  }, [controller, isMenuOpen]);

  return controller.view;
}
