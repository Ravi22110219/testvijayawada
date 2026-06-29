import type { OptionItem } from "../../types/api";
import styles from "./SelectField.module.css";

export function SelectField(props: {
  label: string;
  value: string;
  options?: OptionItem[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.selectField}>
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}>
        {(props.options || [{ id: props.value, label: props.value }]).map((item) => (
          <option value={item.id} key={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
