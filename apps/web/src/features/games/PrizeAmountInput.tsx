import { formatPrizeInput } from "../../money";

type Props = {
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function PrizeAmountInput({ value, error, disabled, onChange }: Props) {
  return (
    <label className="prize-input-field">
      <span>Monto del premio</span>
      <span className={`prize-input-control ${error ? "is-invalid" : ""}`}>
        <strong aria-hidden="true">$</strong>
        <input
          required
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1.500.000"
          disabled={disabled}
          value={formatPrizeInput(value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "prize-amount-error" : undefined}
          onChange={(event) => {
            const normalized = event.target.value.replace(/[.\s]/g, "");
            if (normalized && !/^\d+$/.test(normalized)) return;
            onChange(normalized);
          }}
          onKeyDown={(event) => {
            if (["e", "E", "+", "-", ","].includes(event.key))
              event.preventDefault();
          }}
        />
      </span>
      {error && (
        <small className="field-error" id="prize-amount-error">
          {error}
        </small>
      )}
    </label>
  );
}
