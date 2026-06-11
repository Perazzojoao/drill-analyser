"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UploadCloud } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { normalizeCsvDataset } from "@/lib/drilling/normalize";
import { uploadFormSchema, uploadRecoveryMessages, type UploadFormValues } from "@/lib/forms/upload-schema";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export function CsvUploadForm() {
  const setActiveDataset = useDashboardStore((state) => state.setActiveDataset);
  const setParseStatus = useDashboardStore((state) => state.setParseStatus);
  const [statusMessage, setStatusMessage] = useState<string>();
  const form = useForm<UploadFormValues>({ resolver: zodResolver(uploadFormSchema) });

  async function onSubmit(values: UploadFormValues) {
    setParseStatus("parsing");
    setStatusMessage("Parsing CSV locally in this browser session...");

    try {
      const text = await values.file.text();
      const dataset = normalizeCsvDataset(text, {
        sourceName: values.file.name,
        sizeBytes: values.file.size,
      });
      setActiveDataset(dataset);
      setStatusMessage(`Loaded ${dataset.rowCount.toLocaleString()} rows from ${dataset.sourceName}.`);
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV parsing failed.";
      setParseStatus("error", message);
      setStatusMessage(`${message} ${uploadRecoveryMessages.parseFailed}`);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="file"
          render={({ field }) => {
            const { onChange, value, ...inputProps } = field;
            void value;

            return (
              <FormItem>
                <FormLabel>CSV drilling data</FormLabel>
                <FormControl>
                  <Input
                    {...inputProps}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => onChange(event.target.files?.[0])}
                  />
                </FormControl>
                <FormDescription>
                  Upload stays local to this session. Target size is 25 MB or 250,000 rows.
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            {form.formState.isSubmitting ? "Parsing..." : "Upload CSV"}
          </Button>
          {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
        </div>
      </form>
    </Form>
  );
}
