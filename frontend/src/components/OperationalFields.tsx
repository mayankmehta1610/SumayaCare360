export type OperationalField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  section?: string;
  placeholder?: string;
  help?: string;
};

type Props = {
  fields: OperationalField[];
  values: Record<string, string | boolean>;
  onChange: (values: Record<string, string | boolean>) => void;
};

export default function OperationalFields({ fields, values, onChange }: Props) {
  const update = (key: string, value: string | boolean) => onChange({ ...values, [key]: value });

  return (
    <div className="domain-form-grid">
      {fields.map((field) => (
        <div className={`field ${field.type === "textarea" ? "field--wide" : ""}`} key={field.key}>
          {field.type === "checkbox" ? (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(event) => update(field.key, event.target.checked)}
              />
              <span>{field.label}</span>
            </label>
          ) : (
            <>
              <label>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
              {field.type === "textarea" ? (
                <textarea
                  required={field.required}
                  rows={3}
                  value={String(values[field.key] ?? "")}
                  placeholder={field.placeholder}
                  onChange={(event) => update(field.key, event.target.value)}
                />
              ) : field.type === "select" ? (
                <select
                  required={field.required}
                  value={String(values[field.key] ?? "")}
                  onChange={(event) => update(field.key, event.target.value)}
                >
                  <option value="">Select</option>
                  {(field.options || []).map((option) => (
                    <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
                  ))}
                </select>
              ) : (
                <input
                  required={field.required}
                  type={field.type === "datetime" ? "datetime-local" : ["date", "number", "email", "tel", "url"].includes(field.type) ? field.type : "text"}
                  min={field.type === "number" ? 0 : undefined}
                  value={String(values[field.key] ?? "")}
                  placeholder={field.placeholder}
                  onChange={(event) => update(field.key, event.target.value)}
                />
              )}
              {field.help && <small className="field-help">{field.help}</small>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
