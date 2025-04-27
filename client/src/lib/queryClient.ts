import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
