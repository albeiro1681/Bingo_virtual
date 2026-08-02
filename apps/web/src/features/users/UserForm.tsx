import type { PlayerDraft } from "./types";
import { countryCodes } from "./user-utils";

type Props = {
  value: PlayerDraft;
  onChange: (value: PlayerDraft) => void;
  errors: { name?: string; phoneNumber?: string };
  showActive?: boolean;
};

export function UserForm({
  value,
  onChange,
  errors,
  showActive = false,
}: Props) {
  return (
    <div className="user-form-fields">
      <label>
        <span>Nombre completo</span>
        <input
          autoComplete="name"
          value={value.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "user-name-error" : undefined}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
        {errors.name && (
          <small className="field-error" id="user-name-error">
            {errors.name}
          </small>
        )}
      </label>
      <div className="phone-fields">
        <label>
          <span>Indicativo</span>
          <select
            aria-label="Indicativo del país"
            value={value.countryCode}
            onChange={(event) =>
              onChange({ ...value, countryCode: event.target.value })
            }
          >
            {countryCodes.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Número de WhatsApp</span>
          <input
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="313 462 1322"
            value={value.phoneNumber}
            aria-invalid={Boolean(errors.phoneNumber)}
            aria-describedby={
              errors.phoneNumber ? "user-phone-error" : undefined
            }
            onChange={(event) =>
              onChange({
                ...value,
                phoneNumber: event.target.value.replace(/\D/g, ""),
              })
            }
          />
          {errors.phoneNumber && (
            <small className="field-error" id="user-phone-error">
              {errors.phoneNumber}
            </small>
          )}
        </label>
      </div>
      {showActive && (
        <label className="user-checkbox">
          <input
            type="checkbox"
            checked={value.active}
            onChange={(event) =>
              onChange({ ...value, active: event.target.checked })
            }
          />
          <span>Jugador activo</span>
        </label>
      )}
    </div>
  );
}
