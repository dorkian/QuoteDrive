import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FIELD_CLASSES, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/TagInput";
import { cn } from "@/lib/utils";
import { COMPANY_SIZE_OPTIONS } from "../../lib/customer-profile";
import type { CompanySize, Customer, CustomerInput } from "../../lib/api";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer being edited; omit to create a new one. */
  customer?: Customer;
  /** Rejects with a user-facing message on failure. */
  onSubmit: (input: CustomerInput) => Promise<void>;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSubmit,
}: CustomerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CustomerForm
          customer={customer}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

const ABOUT_MAX = 600;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function Field({
  label,
  optional = true,
  htmlFor,
  children,
  className,
}: {
  label: string;
  optional?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      {children}
    </div>
  );
}

const blank = (value: string): string | null => value.trim() || null;

// Mounted only while the dialog is open, so every open starts from the
// customer's current values instead of a stale draft.
function CustomerForm({
  customer,
  onSubmit,
  onCancel,
}: {
  customer?: Customer;
  onSubmit: (input: CustomerInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [industry, setIndustry] = useState(customer?.industry ?? "");
  const [tags, setTags] = useState<string[]>(customer?.industry_tags ?? []);
  const [website, setWebsite] = useState(customer?.website ?? "");
  const [city, setCity] = useState(customer?.hq_city ?? "");
  const [country, setCountry] = useState(customer?.hq_country ?? "");
  const [size, setSize] = useState<CompanySize | "">(
    customer?.company_size ?? "",
  );
  const [about, setAbout] = useState(customer?.about ?? "");
  const [contactName, setContactName] = useState(customer?.contact_name ?? "");
  const [contactTitle, setContactTitle] = useState(
    customer?.contact_title ?? "",
  );
  const [contactEmail, setContactEmail] = useState(
    customer?.contact_email ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = customer !== undefined;
  const trimmedName = name.trim();

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!trimmedName) {
      setError("Enter a customer name.");
      return;
    }
    if (contactEmail.trim() && !EMAIL_RE.test(contactEmail.trim())) {
      setError("Enter a valid contact email.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmedName,
        industry: blank(industry),
        industry_tags: tags.length > 0 ? tags : null,
        website: blank(website),
        hq_city: blank(city),
        hq_country: blank(country),
        company_size: size || null,
        about: blank(about),
        contact_name: blank(contactName),
        contact_title: blank(contactTitle),
        contact_email: blank(contactEmail),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"
      onInteractOutside={(event) => {
        if (saving) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Changes are recorded in the audit log."
            : "Customers hold the opportunities you build proposals for."}{" "}
          The more you add, the better AI can tailor its drafts. It never sees
          the contact's email.
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold text-foreground">
            Company
          </legend>
          <Field
            label="Customer name"
            optional={false}
            htmlFor="cust-name"
            className="sm:col-span-2"
          >
            <Input
              id="cust-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              autoFocus
              required
              aria-invalid={error !== null && !trimmedName}
            />
          </Field>
          <Field label="Industry" htmlFor="cust-industry">
            <Input
              id="cust-industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              maxLength={128}
              placeholder="e.g. Healthcare"
            />
          </Field>
          <Field label="Company size" htmlFor="cust-size">
            <select
              id="cust-size"
              value={size}
              onChange={(event) =>
                setSize(event.target.value as CompanySize | "")
              }
              className={cn(FIELD_CLASSES, "h-10")}
            >
              <option value="">Not set</option>
              {COMPANY_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Industry tags"
            htmlFor="cust-tags"
            className="sm:col-span-2"
          >
            <TagInput
              id="cust-tags"
              value={tags}
              onChange={setTags}
              placeholder="Add a focus area, press Enter"
            />
          </Field>
          <Field label="About" htmlFor="cust-about" className="sm:col-span-2">
            <Textarea
              id="cust-about"
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              maxLength={ABOUT_MAX}
              placeholder="What the company does, in a sentence or two"
              className="min-h-20 text-base sm:text-sm"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {about.length} / {ABOUT_MAX}
            </span>
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold text-foreground">
            Where to find them
          </legend>
          <Field
            label="Website"
            htmlFor="cust-website"
            className="sm:col-span-2"
          >
            <Input
              id="cust-website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              maxLength={255}
              inputMode="url"
              placeholder="acme.example"
            />
          </Field>
          <Field label="City" htmlFor="cust-city">
            <Input
              id="cust-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={128}
            />
          </Field>
          <Field label="Country" htmlFor="cust-country">
            <Input
              id="cust-country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              maxLength={128}
            />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold text-foreground">
            Primary contact
          </legend>
          <Field label="Contact name" htmlFor="cust-contact">
            <Input
              id="cust-contact"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              maxLength={128}
            />
          </Field>
          <Field label="Job title" htmlFor="cust-title">
            <Input
              id="cust-title"
              value={contactTitle}
              onChange={(event) => setContactTitle(event.target.value)}
              maxLength={128}
            />
          </Field>
          <Field
            label="Contact email"
            htmlFor="cust-email"
            className="sm:col-span-2"
          >
            <Input
              id="cust-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              maxLength={255}
              placeholder="name@acme.example"
            />
          </Field>
        </fieldset>

        {error && (
          <p className="text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
