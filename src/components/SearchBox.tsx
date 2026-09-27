export default function SearchBox({ q, placeholder, label, extra }: { q: string; placeholder: string; label: string; extra?: React.ReactNode }) {
  return (
    <form className="flex gap-2" role="search">
      <input name="q" defaultValue={q} placeholder={placeholder} className="input flex-1" autoComplete="off" />
      {extra}
      <button className="btn-primary">{label}</button>
    </form>
  );
}
