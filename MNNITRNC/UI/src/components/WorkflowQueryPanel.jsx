import { useEffect, useState } from 'react';
import { listWorkflowQueries, askWorkflowQuery, answerWorkflowQuery } from '../api/workflowApi';

export default function WorkflowQueryPanel({ workflowInstanceId, currentUserId, priorActors }) {
  const [queries, setQueries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [askedOfUserId, setAskedOfUserId] = useState('');
  const [question, setQuestion] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = () => {
    if (!workflowInstanceId) return;
    setIsLoading(true);
    listWorkflowQueries(workflowInstanceId)
      .then((data) => setQueries(data ?? []))
      .catch(() => setError('Failed to load queries.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [workflowInstanceId]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!askedOfUserId || !question.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await askWorkflowQuery(workflowInstanceId, { askedOfUserId, question });
      setQuestion('');
      setAskedOfUserId('');
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswer = async (queryId) => {
    const answer = answerDrafts[queryId];
    if (!answer?.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await answerWorkflowQuery(queryId, { answer });
      setAnswerDrafts((d) => ({ ...d, [queryId]: '' }));
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return null; // matches ApprovalTimeline's own quiet-loading convention

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-rose-600">{error}</div>}

      {queries.length === 0 && (
        <p className="text-sm text-slate-400">No internal queries on this proposal yet.</p>
      )}

      {queries.map((q) => (
        <div key={q.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm">
          <p className="font-medium text-slate-700 dark:text-slate-200">{q.question}</p>
          <p className="text-xs text-slate-400 mt-1">{new Date(q.askedAt).toLocaleString()}</p>
          {q.answer ? (
            <p className="mt-2 text-slate-600 dark:text-slate-300">↳ {q.answer}</p>
          ) : q.askedOfUserId === currentUserId ? (
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded"
                value={answerDrafts[q.id] ?? ''}
                onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                placeholder="Reply..."
              />
              <button
                type="button"
                onClick={() => handleAnswer(q.id)}
                disabled={isSubmitting}
                className="text-xs px-3 py-1 bg-indigo-600 text-white rounded"
              >
                Reply
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400 italic">Awaiting reply...</p>
          )}
        </div>
      ))}

      {priorActors?.length > 0 && (
        <form onSubmit={handleAsk} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <select
            value={askedOfUserId}
            onChange={(e) => setAskedOfUserId(e.target.value)}
            className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded"
          >
            <option value="">Ask...</option>
            {priorActors.map((a) => (
              <option key={a.userId} value={a.userId}>{a.label}</option>
            ))}
          </select>
          <input
            className="flex-1 text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Your question..."
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-xs px-3 py-1 bg-indigo-600 text-white rounded"
          >
            Ask
          </button>
        </form>
      )}
    </div>
  );
}
