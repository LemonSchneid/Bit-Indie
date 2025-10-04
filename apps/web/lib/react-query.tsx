"use client";

import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type QueryKey = readonly unknown[];

type Listener = () => void;

function hashQueryKey(key: QueryKey): string {
  return JSON.stringify(key);
}

class QueryStore {
  private readonly data = new Map<string, unknown>();
  private readonly listeners = new Map<string, Set<Listener>>();

  get(key: QueryKey): unknown | undefined {
    const hashed = hashQueryKey(key);
    if (!this.data.has(hashed)) {
      return undefined;
    }
    return this.data.get(hashed);
  }

  set(key: QueryKey, value: unknown): void {
    const hashed = hashQueryKey(key);
    this.data.set(hashed, value);
    const listeners = this.listeners.get(hashed);
    if (!listeners) {
      return;
    }
    listeners.forEach((listener) => listener());
  }

  subscribe(key: QueryKey, listener: Listener): () => void {
    const hashed = hashQueryKey(key);
    let listeners = this.listeners.get(hashed);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(hashed, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners && listeners.size === 0) {
        this.listeners.delete(hashed);
      }
    };
  }
}

export class QueryClient {
  private readonly store = new QueryStore();

  getQueryData<T>(key: QueryKey): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  setQueryData<T>(key: QueryKey, value: T): void {
    this.store.set(key, value);
  }

  subscribe(key: QueryKey, listener: Listener): () => void {
    return this.store.subscribe(key, listener);
  }
}

const QueryClientContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({
  client,
  children,
}: PropsWithChildren<{ client: QueryClient }>): JSX.Element {
  return (
    <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>
  );
}

export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext);
  if (!client) {
    throw new Error("useQueryClient must be used within a QueryClientProvider");
  }
  return client;
}

interface UseQueryOptions<TQueryFnData> {
  queryKey: QueryKey;
  queryFn?: () => Promise<TQueryFnData> | TQueryFnData;
  initialData?: () => TQueryFnData;
}

export function useQuery<TData>({
  queryKey,
  queryFn,
  initialData,
}: UseQueryOptions<TData>): { data: TData | undefined } {
  const client = useQueryClient();
  const keyHash = useMemo(() => hashQueryKey(queryKey), [queryKey]);
  const memoizedQueryKeyRef = useRef<QueryKey>(queryKey);
  useEffect(() => {
    memoizedQueryKeyRef.current = queryKey;
  }, [keyHash, queryKey]);
  const hasMounted = useRef(false);

  const [data, setData] = useState<TData | undefined>(() => {
    const currentKey = memoizedQueryKeyRef.current;
    const existing = client.getQueryData<TData>(currentKey);
    if (existing !== undefined) {
      return existing;
    }
    if (initialData) {
      const initial = initialData();
      client.setQueryData(currentKey, initial);
      return initial;
    }
    return undefined;
  });

  useEffect(() => {
    const currentKey = memoizedQueryKeyRef.current;
    return client.subscribe(currentKey, () => {
      setData(client.getQueryData<TData>(currentKey));
    });
  }, [client, keyHash]);

  useEffect(() => {
    if (!queryFn) {
      return;
    }
    let cancelled = false;
    const execute = async () => {
      try {
        const result = await queryFn();
        if (!cancelled) {
          const currentKey = memoizedQueryKeyRef.current;
          client.setQueryData(currentKey, result);
          setData(result);
        }
      } catch (error) {
        if (!cancelled && !hasMounted.current) {
          // Avoid double logging in strict mode by only surfacing initial errors.
          console.error("useQuery failed", error);
        }
      }
    };
    execute();
    hasMounted.current = true;
    return () => {
      cancelled = true;
    };
  }, [client, keyHash, queryFn]);

  return { data };
}

interface MutationState<TError> {
  status: "idle" | "pending" | "success" | "error";
  error: TError | null;
}

interface UseMutationOptions<TData, TVariables, TError> {
  mutationFn: (variables: TVariables) => Promise<TData> | TData;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: TError | null, variables: TVariables) => void;
}

export function useMutation<TData = void, TVariables = void, TError = unknown>({
  mutationFn,
  onSuccess,
  onError,
  onSettled,
}: UseMutationOptions<TData, TVariables, TError>) {
  const [state, setState] = useState<MutationState<TError>>({ status: "idle", error: null });

  const mutateAsync = async (variables: TVariables): Promise<TData> => {
    setState({ status: "pending", error: null });
    try {
      const result = await mutationFn(variables);
      setState({ status: "success", error: null });
      onSuccess?.(result, variables);
      onSettled?.(result, null, variables);
      return result;
    } catch (error) {
      const typedError = error as TError;
      setState({ status: "error", error: typedError });
      onError?.(typedError, variables);
      onSettled?.(null, typedError, variables);
      throw error;
    }
  };

  const mutate = (variables: TVariables) => {
    void mutateAsync(variables);
  };

  const reset = () => setState({ status: "idle", error: null });

  return {
    mutate,
    mutateAsync,
    reset,
    status: state.status,
    error: state.error,
    isPending: state.status === "pending",
    isError: state.status === "error",
    isSuccess: state.status === "success",
  };
}
