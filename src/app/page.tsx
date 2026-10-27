import { Extractor } from '@/components/extractor'

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Doc Extraction Copilot</div>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">Brazilian financial documents to checked, typed data</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Upload a photo or PDF of a boleto, a nota fiscal (DANFE) or an informe de rendimentos. A vision model reads it, code checks every field it can,
          and you only look at the ones that did not pass.
        </p>
      </header>
      <Extractor />
      <footer className="mt-10 text-xs text-zinc-500">
        Documents are sent to Google&apos;s Gemini API to be read and are not stored here. The samples are fictional.{' '}
        <a href="https://github.com/Eric-Souza/doc-extraction-copilot" className="underline">
          Source on GitHub
        </a>
      </footer>
    </main>
  )
}
