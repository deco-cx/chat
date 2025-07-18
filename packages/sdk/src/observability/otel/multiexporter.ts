// deno-lint-ignore-file no-explicit-any
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { type ExportResult, ExportResultCode } from "@opentelemetry/core";

// First implementation, completely synchronous, more tested.

export class MultiSpanExporter implements SpanExporter {
  private exporters: Array<SpanExporter>;
  constructor(exporters: Array<SpanExporter>) {
    this.exporters = exporters;
  }

  export(items: any[], resultCallback: (result: ExportResult) => void): void {
    for (const exporter of this.exporters) {
      exporter.export(items, resultCallback);
    }
  }

  async shutdown(): Promise<void> {
    for (const exporter of this.exporters) {
      await exporter.shutdown();
    }
  }
}

// async

export class MultiSpanExporterAsync implements SpanExporter {
  private exporters: Array<SpanExporter>;
  constructor(exporters: Array<SpanExporter>) {
    this.exporters = exporters;
  }

  export(items: any[], resultCallback: (result: ExportResult) => void): void {
    const promises = this.exporters.map(
      (exporter) =>
        new Promise<ExportResult>((resolve) => {
          exporter.export(items, resolve);
        }),
    );

    Promise.all(promises).then((results) => {
      const failed = results.filter(
        (result) => result.code === ExportResultCode.FAILED,
      );
      if (failed.length > 0) {
        // not ideal, but just return the first error
        resultCallback({
          code: ExportResultCode.FAILED,
          error: failed[0]!.error,
        });
      } else {
        resultCallback({ code: ExportResultCode.SUCCESS });
      }
    });
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.exporters.map((exporter) => exporter.shutdown()));
  }
}
