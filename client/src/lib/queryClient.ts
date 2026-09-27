import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;

    try {
      const payload = JSON.parse(text);
      if (typeof payload.error === "string") {
        message = payload.error;
      } else if (typeof payload.error?.message === "string") {
        message = payload.error.message;
      } else if (typeof payload.message === "string") {
        message = payload.message;
      }
    } catch {
      // Keep plain-text error responses readable.
    }

    throw new Error(`${res.status}: ${message}`);
  }
}

export async function apiRequest(
  urlOrOptions: string | { url: string; method?: string; body?: any; headers?: Record<string, string>; customConfig?: any },
  optionsOrData?: { method?: string; body?: any; headers?: Record<string, string>; customConfig?: any } | unknown,
): Promise<any> {
  let url: string;
  let options: any = { credentials: "include" };

  // Handle overloaded function signature
  if (typeof urlOrOptions === 'string') {
    url = urlOrOptions;
    
    // If second parameter is an object with method, treat it as options
    if (optionsOrData && typeof optionsOrData === 'object' && 'method' in optionsOrData) {
      options = {
        ...options,
        ...optionsOrData,
      };
      delete options.customConfig;

      // Without a JSON Content-Type the server ignores the body entirely
      const body = options.body;
      const isRawBody =
        body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams;
      if (body !== undefined && body !== null && !isRawBody) {
        const hasContentType = Object.keys(options.headers ?? {}).some(
          (name) => name.toLowerCase() === 'content-type',
        );
        if (!hasContentType) {
          options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        }
        if (typeof body !== 'string') {
          options.body = JSON.stringify(body);
        }
      }
    } 
    // Otherwise treat it as data for a POST request
    else if (optionsOrData !== undefined) {
      options.method = 'POST';
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(optionsOrData);
    }
  } else {
    // First parameter is an options object with url
    url = urlOrOptions.url;
    options = {
      ...options,
      method: urlOrOptions.method || 'GET',
      ...urlOrOptions,
    };
    
    // Handle body content type 
    if (options.body) {
      if (options.customConfig?.isFormData) {
        // Don't set Content-Type for FormData (browser will set it with boundary)
        delete options.headers['Content-Type'];
      } else {
        // Set JSON Content-Type for non-FormData
        options.headers = {
          'Content-Type': 'application/json',
          ...options.headers,
        };
        
        if (typeof options.body !== 'string') {
          options.body = JSON.stringify(options.body);
        }
      }
    }
    
    // Remove url and customConfig from fetch options
    delete options.url;
    delete options.customConfig;
  }

  const res = await fetch(url, options);
  await throwIfResNotOk(res);
  
  // Try to parse as JSON, fall back to text or raw response
  try {
    return await res.json();
  } catch (error) {
    try {
      return await res.text();
    } catch {
      return res;
    }
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
