"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSampleDataset } from "@/lib/api/drilling-client";

export function useSampleDataset() {
  return useQuery({
    queryKey: ["drilling", "sample"],
    queryFn: fetchSampleDataset,
    retry: 1,
  });
}
