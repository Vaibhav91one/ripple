// Product UI components (components/ui): props in, callbacks out, shown with sample props.
// To add a section (e.g. agent components), add a file under sections/ and list it in sections/index.ts.
import { sections } from "./sections";

export default function UiStyleguide() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-14 p-8">
      <header className="space-y-2">
        <h1 className="text-xl">UI components</h1>
        <p className="max-w-3xl text-faint">Generic, props-driven components in components/ui, rendered on the app tokens.</p>
      </header>
      {sections.map(({ id, title, note, Component }) => (
        <section key={id} id={id} className="space-y-6">
          <header className="space-y-1 border-b border-hairline pb-3">
            <h2 className="text-lg">{title}</h2>
            <p className="text-faint">{note}</p>
          </header>
          <Component />
        </section>
      ))}
    </main>
  );
}
