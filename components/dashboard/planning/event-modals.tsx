"use client";

import { useState } from "react";
import { Xmark, Search, WarningTriangle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import {
  Field,
  fieldInputClass,
  fieldLabelClass,
  NativeSelect,
  TextArea,
  TextInput,
  ToggleRow,
} from "@/components/ui/form-field";
import { useCatalogItems } from "@/services";
import {
  usePlanningEvent,
  useCreatePlanningEvent,
  useUpdatePlanningEvent,
} from "@/services/planning/hooks";
import type {
  CreateCalendarEventPayload,
  EventType,
} from "@/services/planning/types";
import { EVENT_TYPE_LABELS, eventTypeEnum } from "@/services/planning/types";
import { getStatusLabels, toIso } from "./planning-helpers";

const DEFAULT_EVENT_TYPE: EventType = "RESERVATION";

// ─────────────────────────────────────────────────────────────────────────────
// Item picker (promotion → affected menu items)
// ─────────────────────────────────────────────────────────────────────────────

function ItemPicker({
  orgId,
  selected,
  onChange,
}: {
  orgId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: items = [], isLoading } = useCatalogItems(orgId, !!orgId);

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  return (
    <div>
      <label className={fieldLabelClass}>
        {t("planning.affected_menu_items")}
        {selected.length > 0 ? (
          <span className="ml-1.5 rounded-full bg-status-success/20 px-1.5 py-0.5 text-[9px] font-bold text-status-success">
            {selected.length} {t("planning.selected")}
          </span>
        ) : null}
      </label>
      <p className="mb-2 text-[11px] text-text-muted">
        {t("planning.forecast_boost_explanation")}
      </p>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("planning.search_items")}
          className={`${fieldInputClass} py-2 pl-8 pr-3`}
        />
      </div>

      <div className="max-h-36 overflow-y-auto rounded-xl border border-surface-4 bg-surface-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-muted">
            {items.length === 0
              ? t("planning.no_items_in_catalog")
              : t("planning.no_items_match")}
          </p>
        ) : (
          filtered.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2 ${
                  isSelected ? "bg-status-success/5" : ""
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                    isSelected
                      ? "border-status-success bg-status-success text-white"
                      : "border-surface-4"
                  }`}
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span className="text-sm text-text-primary">{item.title}</span>
                {item.unit ? (
                  <span className="ml-auto text-[10px] text-text-muted">
                    {item.unit}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal chrome shared by create + edit
// ─────────────────────────────────────────────────────────────────────────────

function EventModalFrame({
  eyebrow,
  title,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-lg",
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`w-full ${maxWidthClass} rounded-2xl border border-surface-4 bg-surface-1 shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-surface-4 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {eyebrow}
            </p>
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted hover:text-text-primary transition-colors"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">{children}</div>

        <div className="flex items-center justify-end gap-3 border-t border-surface-4 px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  );
}

function ModalFooterButtons({
  onClose,
  onSubmit,
  submitLabel,
  pendingLabel,
  isPending,
  disabled,
}: {
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        {t("planning.cancel")}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending || disabled}
        className="inline-flex h-9 items-center rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-all hover:bg-brand-gold-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create event modal
// ─────────────────────────────────────────────────────────────────────────────

export function CreateEventModal({
  defaultDate,
  branchId,
  orgId,
  onClose,
}: {
  defaultDate: string;
  branchId: string;
  orgId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createMutation = useCreatePlanningEvent();

  const [form, setForm] = useState({
    title: "",
    event_type: DEFAULT_EVENT_TYPE as EventType,
    start_date: defaultDate,
    start_time: "09:00",
    end_time: "17:00",
    description: "",
    expected_demand_impact: "",
    all_branches: false,
    // Promotion sub-fields
    promotion_name: "",
    expected_uplift: "",
    discount_type: "PERCENTAGE",
    promotion_channel: "IN_STORE",
    // Reservation sub-fields
    guest_count: "",
    reservation_type: "OTHER",
    confirmed: false,
    // Closure sub-fields
    closure_reason: "",
    full_day: true,
    // Delivery sub-fields
    supplier_name: "",
    // Operational note
    note_content: "",
  });

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const buildDetails = (): Record<string, unknown> => {
    switch (form.event_type) {
      case "PROMOTION":
        return {
          promotion_name: form.promotion_name || form.title,
          discount_type: form.discount_type,
          discount_value: "0",
          promotion_channel: form.promotion_channel,
          expected_uplift:
            form.expected_uplift !== "" ? Number(form.expected_uplift) / 100 : null,
          is_recurring: false,
          affected_items: selectedItemIds,
        };
      case "RESERVATION":
        return {
          guest_count: Number(form.guest_count) || 1,
          reservation_type: form.reservation_type,
          service_period: "ALL_DAY",
          confirmed: form.confirmed,
        };
      case "CLOSURE":
        return {
          reason: form.closure_reason || "Closed",
          partial_day: !form.full_day,
          full_day: form.full_day,
        };
      case "DELIVERY":
        return {
          supplier_name: form.supplier_name,
          delivery_date: form.start_date,
          items: [],
          delivery_status: "PENDING",
        };
      case "OPERATIONAL_NOTE":
        return {
          note_type: "OTHER",
          content: form.note_content || form.description,
        };
      default:
        return {};
    }
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setError(t("planning.title_required"));
      return;
    }
    if (form.event_type === "RESERVATION" && !form.guest_count) {
      setError(t("planning.guest_count_required"));
      return;
    }
    if (form.event_type === "DELIVERY" && !form.supplier_name.trim()) {
      setError(t("planning.supplier_name_required"));
      return;
    }
    setError("");

    const startDt = `${form.start_date}T${form.start_time}:00`;
    const endDt = `${form.start_date}T${form.end_time}:00`;
    const details = buildDetails();

    const payload: CreateCalendarEventPayload = {
      title: form.title.trim(),
      event_type: form.event_type,
      start_datetime: startDt,
      end_datetime: endDt,
      description: form.description.trim(),
      branch: form.all_branches ? null : branchId || null,
      is_forecast_signal: true,
      expected_demand_impact:
        form.expected_demand_impact !== ""
          ? Number(form.expected_demand_impact) / 100
          : null,
      ...(Object.keys(details).length > 0 ? { details } : {}),
    };

    createMutation.mutate(payload, { onSuccess: onClose });
  };

  const eventTypes = eventTypeEnum.options as EventType[];

  return (
    <EventModalFrame
      eyebrow={t("planning.new_event")}
      title={t("planning.add_to_planning_calendar")}
      onClose={onClose}
      footer={
        <ModalFooterButtons
          onClose={onClose}
          onSubmit={handleSubmit}
          submitLabel={t("planning.add_event")}
          pendingLabel={t("planning.saving")}
          isPending={createMutation.isPending}
        />
      }
    >
      <div className="space-y-4 px-6 py-5">
        {error ? (
          <p className="rounded-lg border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
            {error}
          </p>
        ) : null}

        <Field label={t("planning.title")}>
          <TextInput
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={t("planning.placeholder_wedding")}
          />
        </Field>

        <Field label={t("planning.type")}>
          <NativeSelect
            value={form.event_type}
            onChange={(e) => {
              set("event_type", e.target.value as EventType);
              setSelectedItemIds([]);
            }}
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {form.start_date && form.start_date < toIso(new Date()) ? (
          <div className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/10 px-3 py-2">
            <WarningTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
            <p className="text-[11px] text-status-warning">
              {t("planning.past_date_warning")}
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("planning.date")}>
            <TextInput
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </Field>
          <Field label={t("planning.start")}>
            <TextInput
              type="time"
              value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)}
            />
          </Field>
          <Field label={t("planning.end")}>
            <TextInput
              type="time"
              value={form.end_time}
              onChange={(e) => set("end_time", e.target.value)}
            />
          </Field>
        </div>

        {/* ── Type-specific sub-fields ── */}

        {form.event_type === "PROMOTION" ? (
          <div className="space-y-4 rounded-xl border border-status-success/20 bg-status-success/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-status-success">
              {t("planning.promotion_details")}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("planning.promotion_name")}>
                <TextInput
                  value={form.promotion_name}
                  onChange={(e) => set("promotion_name", e.target.value)}
                  placeholder={t("planning.placeholder_happy_hour")}
                />
              </Field>
              <Field label={t("planning.expected_uplift")}>
                <TextInput
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={form.expected_uplift}
                  onChange={(e) => set("expected_uplift", e.target.value)}
                  placeholder={t("planning.placeholder_uplift")}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("planning.discount_type")}>
                <NativeSelect
                  value={form.discount_type}
                  onChange={(e) => set("discount_type", e.target.value)}
                >
                  <option value="PERCENTAGE">{t("planning.percentage")}</option>
                  <option value="FIXED">{t("planning.fixed_amount")}</option>
                  <option value="BOGO">{t("planning.buy_one_get_one")}</option>
                  <option value="FREE_ITEM">{t("planning.free_item")}</option>
                </NativeSelect>
              </Field>
              <Field label={t("planning.channel")}>
                <NativeSelect
                  value={form.promotion_channel}
                  onChange={(e) => set("promotion_channel", e.target.value)}
                >
                  <option value="IN_STORE">{t("planning.in_store")}</option>
                  <option value="ONLINE">{t("planning.online")}</option>
                  <option value="SOCIAL_MEDIA">{t("planning.social_media")}</option>
                  <option value="ALL">{t("planning.all_channels")}</option>
                </NativeSelect>
              </Field>
            </div>

            <ItemPicker
              orgId={orgId}
              selected={selectedItemIds}
              onChange={setSelectedItemIds}
            />
          </div>
        ) : null}

        {form.event_type === "RESERVATION" ? (
          <div className="space-y-4 rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold">
              {t("planning.reservation_details")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("planning.guest_count")}>
                <TextInput
                  type="number"
                  min="1"
                  value={form.guest_count}
                  onChange={(e) => set("guest_count", e.target.value)}
                  placeholder={t("planning.placeholder_guest_count")}
                />
              </Field>
              <Field label={t("planning.type")}>
                <NativeSelect
                  value={form.reservation_type}
                  onChange={(e) => set("reservation_type", e.target.value)}
                >
                  <option value="WEDDING">{t("planning.wedding")}</option>
                  <option value="CORPORATE">{t("planning.corporate")}</option>
                  <option value="BIRTHDAY">{t("planning.birthday")}</option>
                  <option value="CONFERENCE">{t("planning.conference")}</option>
                  <option value="PRIVATE_DINING">
                    {t("planning.private_dining")}
                  </option>
                  <option value="OTHER">{t("planning.other")}</option>
                </NativeSelect>
              </Field>
            </div>
            <ToggleRow
              checked={form.confirmed}
              onChange={(v) => set("confirmed", v)}
              label={t("planning.reservation_confirmed")}
            />
          </div>
        ) : null}

        {form.event_type === "CLOSURE" ? (
          <div className="space-y-4 rounded-xl border border-status-critical/20 bg-status-critical/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-status-critical">
              {t("planning.closure_details")}
            </p>
            <Field label={t("planning.reason")}>
              <TextInput
                value={form.closure_reason}
                onChange={(e) => set("closure_reason", e.target.value)}
                placeholder={t("planning.placeholder_reason")}
              />
            </Field>
            <ToggleRow
              checked={form.full_day}
              onChange={(v) => set("full_day", v)}
              label={t("planning.full_day_closure")}
            />
          </div>
        ) : null}

        {form.event_type === "DELIVERY" ? (
          <div className="space-y-4 rounded-xl border border-status-info/20 bg-status-info/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-status-info">
              {t("planning.delivery_details")}
            </p>
            <Field label={t("planning.supplier_name")}>
              <TextInput
                value={form.supplier_name}
                onChange={(e) => set("supplier_name", e.target.value)}
                placeholder={t("planning.placeholder_supplier")}
              />
            </Field>
          </div>
        ) : null}

        {form.event_type === "OPERATIONAL_NOTE" ? (
          <div className="space-y-4 rounded-xl border border-surface-4 bg-surface-2 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              {t("planning.note_details")}
            </p>
            <Field label={t("planning.note_content")}>
              <TextArea
                rows={3}
                value={form.note_content}
                onChange={(e) => set("note_content", e.target.value)}
                placeholder={t("planning.placeholder_note")}
                className="bg-surface-1"
              />
            </Field>
          </div>
        ) : null}

        <Field label={t("planning.expected_demand_impact")}>
          <TextInput
            type="number"
            step="1"
            value={form.expected_demand_impact}
            onChange={(e) => set("expected_demand_impact", e.target.value)}
            placeholder={t("planning.placeholder_demand_impact")}
          />
        </Field>

        <Field label={t("planning.notes_optional")}>
          <TextArea
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("planning.placeholder_context")}
          />
        </Field>

        <ToggleRow
          checked={form.all_branches}
          onChange={(v) => set("all_branches", v)}
          label={t("planning.apply_to_all_branches")}
        />
      </div>
    </EventModalFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit event modal
// ─────────────────────────────────────────────────────────────────────────────

export function EditEventModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: event, isLoading } = usePlanningEvent(eventId);
  const updateMutation = useUpdatePlanningEvent();

  const [form, setForm] = useState({
    title: "",
    status: "ACTIVE",
    start_date: "",
    start_time: "09:00",
    end_time: "17:00",
    expected_demand_impact: "",
    description: "",
  });
  const [initialized, setInitialized] = useState(false);

  // Populate form once event detail arrives
  if (event && !initialized) {
    const start = new Date(event.start_datetime);
    const end = new Date(event.end_datetime);
    setForm({
      title: event.title,
      status: event.status,
      start_date: toIso(start),
      start_time: start.toTimeString().slice(0, 5),
      end_time: end.toTimeString().slice(0, 5),
      expected_demand_impact:
        event.expected_demand_impact != null
          ? String(Math.round(event.expected_demand_impact * 100))
          : "",
      description: "",
    });
    setInitialized(true);
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const statusLabels = getStatusLabels(t);

  const handleSubmit = () => {
    const startDt = `${form.start_date}T${form.start_time}:00`;
    const endDt = `${form.start_date}T${form.end_time}:00`;
    updateMutation.mutate(
      {
        eventId,
        payload: {
          title: form.title.trim(),
          status: form.status as "ACTIVE" | "CANCELLED" | "COMPLETED" | "DRAFT",
          start_datetime: startDt,
          end_datetime: endDt,
          expected_demand_impact:
            form.expected_demand_impact !== ""
              ? Number(form.expected_demand_impact) / 100
              : null,
          ...(form.description.trim()
            ? { description: form.description.trim() }
            : {}),
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <EventModalFrame
      eyebrow={t("planning.edit_event")}
      title={t("planning.update_details")}
      onClose={onClose}
      maxWidthClass="max-w-md"
      footer={
        <ModalFooterButtons
          onClose={onClose}
          onSubmit={handleSubmit}
          submitLabel={t("planning.save_changes")}
          pendingLabel={t("planning.saving")}
          isPending={updateMutation.isPending}
          disabled={isLoading}
        />
      }
    >
      <div className="space-y-4 px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : (
          <>
            <Field label={t("planning.title")}>
              <TextInput
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>

            <div>
              <Field label={t("planning.status")}>
                <NativeSelect
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {Object.entries(statusLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {form.status === "CANCELLED" ? (
                <p className="mt-1 text-[11px] text-status-critical">
                  {t("planning.cancelled_hidden_from_forecast")}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label={t("planning.date")}>
                <TextInput
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </Field>
              <Field label={t("planning.start")}>
                <TextInput
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                />
              </Field>
              <Field label={t("planning.end")}>
                <TextInput
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                />
              </Field>
            </div>

            <Field label={t("planning.demand_impact")}>
              <TextInput
                type="number"
                step="1"
                value={form.expected_demand_impact}
                onChange={(e) => set("expected_demand_impact", e.target.value)}
                placeholder={t("planning.placeholder_demand_impact_edit")}
              />
            </Field>

            <Field label={t("planning.update_note")}>
              <TextArea
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder={t("planning.placeholder_reason_change")}
              />
            </Field>
          </>
        )}
      </div>
    </EventModalFrame>
  );
}
