import { Link } from 'react-router-dom';
import PageShell from '../layout/PageShell';

const NotFoundPage = () => (
  <PageShell
    eyebrow="Off track"
    title="Page not found"
    description="This route is outside track limits. Rejoin safely below."
  >
    <div className="empty-state-actions">
      <Link className="pw-button" to="/">Back to schedule</Link>
      <Link className="pw-button ghost" to="/circuits">Browse circuits</Link>
    </div>
  </PageShell>
);

export default NotFoundPage;
