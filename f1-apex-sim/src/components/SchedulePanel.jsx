import { formatDateTime, formatGmtOffset } from '../utils/dateTime';

const SchedulePanel = ({ schedule }) => {
  const upcoming = schedule.upcomingMeetings.slice(0, 5);

  return (
    <section className="panel-section schedule-panel">
      <div className="section-kicker">F1 Calendar</div>

      {schedule.status === 'loading' && (
        <p className="muted-text">Loading current season calendar...</p>
      )}

      {schedule.status === 'error' && (
        <p className="error-text">Calendar could not be loaded.</p>
      )}

      {schedule.status === 'ready' && upcoming.length === 0 && (
        <p className="muted-text">No upcoming races in this season.</p>
      )}

      <div className="schedule-list">
        {upcoming.map((meeting) => (
          <article
            key={meeting.meeting_key}
            className={`schedule-item ${meeting.isCurrent ? 'current' : ''}`}
          >
            <div>
              <strong>{meeting.meeting_name}</strong>
              <span>
                {meeting.circuit_short_name}
                {' '}
                /
                {' '}
                {meeting.country_name}
              </span>
            </div>
            <div className="schedule-time">
              <span>{formatDateTime(meeting.date_start, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span>{formatGmtOffset(meeting.gmt_offset)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default SchedulePanel;
