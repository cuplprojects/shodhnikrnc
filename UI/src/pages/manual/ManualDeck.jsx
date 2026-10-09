import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ListChecks, Menu, X,
} from 'lucide-react';

/**
 * Renders a manual's PDF-derived content as an in-app slide deck: one slide
 * per step, a trailing checklist slide, prev/next controls, keyboard arrow
 * navigation, and a slide-index panel for jumping directly to a step.
 */
export default function ManualDeck({ manual, otherManualLink, otherManualLabel }) {
  const totalSlides = manual.slides.length + 1; // +1 for the checklist slide
  const [index, setIndex] = useState(0);
  const [showIndex, setShowIndex] = useState(false);

  const isChecklist = index === manual.slides.length;
  const slide = isChecklist ? null : manual.slides[index];

  const goTo = useCallback((next) => {
    setIndex(Math.min(Math.max(next, 0), totalSlides - 1));
  }, [totalSlides]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
      if (e.key === 'Escape') setShowIndex(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3 shadow">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/manual" className="p-2 rounded hover:bg-white/10 shrink-0" title="Back to manuals">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="font-semibold truncate">{manual.title}</div>
            <div className="text-xs text-slate-300 truncate hidden sm:block">{manual.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {otherManualLink && (
            <Link
              to={otherManualLink}
              className="hidden sm:inline-block text-xs px-3 py-1.5 rounded border border-white/20 hover:bg-white/10"
            >
              {otherManualLabel}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowIndex((v) => !v)}
            className="p-2 rounded hover:bg-white/10"
            title="Slide index"
          >
            {showIndex ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Slide index panel */}
        {showIndex && (
          <aside className="w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
            <ol className="py-2">
              {manual.slides.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => { goTo(i); setShowIndex(false); }}
                    className={`w-full text-left px-4 py-2 text-sm truncate hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      i === index ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-slate-400 dark:text-slate-500 mr-2">{i + 1}.</span>
                    {s.title}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => { goTo(manual.slides.length); setShowIndex(false); }}
                  className={`w-full text-left px-4 py-2 text-sm truncate hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 ${
                    isChecklist ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <ListChecks size={14} />
                  Review Checklist
                </button>
              </li>
            </ol>
          </aside>
        )}

        {/* Slide area */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              {isChecklist ? (
                <ChecklistSlide manual={manual} />
              ) : (
                <StepSlide slide={slide} index={index} total={manual.slides.length} />
              )}
            </div>
          </div>

          {/* Controls */}
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {index + 1} / {totalSlides}
            </span>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === totalSlides - 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
            >
              Next <ChevronRight size={16} />
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}

function StepSlide({ slide, index, total }) {
  return (
    <div>
      <div className="px-6 sm:px-10 pt-8 pb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">
          Step {index + 1} of {total}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{slide.title}</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">{slide.body}</p>
      </div>
      <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-8">
        {slide.image ? (
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm"
          />
        ) : (
          <div className="w-full aspect-video rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-sm">
            Screenshot not available
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistSlide({ manual }) {
  return (
    <div className="px-6 sm:px-10 py-8">
      <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
        <ListChecks size={14} /> Review Checklist
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">
        End of Manual
      </h2>
      <ul className="space-y-3">
        {manual.checklist.map((item) => (
          <li key={item} className="flex gap-3 text-slate-700 dark:text-slate-200">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        For portal-specific issues, contact the R&C Office/portal administrator and provide the relevant request or project reference along with a screenshot of the issue.
      </p>
    </div>
  );
}
