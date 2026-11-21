CREATE TABLE "request_windows" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expenses_business_due_idx" ON "expenses" USING btree ("business_id","due_date");--> statement-breakpoint
CREATE INDEX "invoices_business_due_idx" ON "invoices" USING btree ("business_id","due_date");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");