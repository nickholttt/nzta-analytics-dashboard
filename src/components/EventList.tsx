import { MEASUREMENT, MEASUREMENT_WARNING } from "../lib/events";
import type { Marker } from "../lib/events";

export function EventList({ markers }: { markers: Marker[] }) {
  if (markers.length === 0) return null;
  return (
    <ol className="events">
      {markers.map((m) => (
        <li key={m.label + m.date}>
          <strong>{m.label}.</strong>{" "}
          {m.events.map((e) => (
            <span key={e.id} className="event">
              {e.date_start}
              {e.date_end ? ` to ${e.date_end}` : ""} <strong>{e.title}</strong>
              {e.announced_date ? ` (announced ${e.announced_date})` : ""}. {e.summary}{" "}
              {e.mechanism === MEASUREMENT ? <em>{MEASUREMENT_WARNING} </em> : null}
              <a href={e.source_url} target="_blank" rel="noreferrer">
                source
              </a>
            </span>
          ))}
        </li>
      ))}
    </ol>
  );
}
