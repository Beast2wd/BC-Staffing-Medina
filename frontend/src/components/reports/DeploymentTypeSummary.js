export const DeploymentTypeSummary = ({ section, color }) => {
  if (!section) return null;
  const text = color === 'orange' ? 'text-orange-500' : 'text-blue-500';
  const bg = color === 'orange' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-blue-500/10 border-blue-500/20';

  return (
    <div className="space-y-4 break-inside-avoid" data-testid={`deployment-summary-${section.deployment_type.toLowerCase()}`}>
      <h3 className={`font-heading text-xl uppercase font-bold border-b pb-2 ${text}`}>
        {section.deployment_type} Deployment Summary
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['Deployments', section.total_deployments],
          ['Personnel Deployed', section.unique_personnel],
          ['Deployment Days', section.total_deployment_days],
          ['Backfill OT Shifts', section.total_backfill_shifts],
          ['Backfill OT Hours', section.total_backfill_hours],
        ].map(([label, value]) => (
          <div key={label} className={`p-3 border rounded-lg text-center ${bg}`}>
            <p className={`text-2xl font-bold ${text}`}>{value || 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h4 className="font-semibold text-sm uppercase tracking-wider mb-2">Apparatus Sent Out</h4>
        {section.apparatus?.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-2 font-semibold">Apparatus</th>
                <th className="text-left p-2 font-semibold">Incident / Location</th>
                <th className="text-left p-2 font-semibold">Departed Home Base</th>
                <th className="text-left p-2 font-semibold">Returned</th>
                <th className="text-left p-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {section.apparatus.map(a => (
                <tr key={a.id} className="border-b border-muted">
                  <td className="p-2 font-medium">{a.apparatus_name}</td>
                  <td className="p-2">{a.location || '-'}</td>
                  <td className="p-2">{a.departure_date}{a.departure_time ? ` @ ${a.departure_time}` : ''}</td>
                  <td className="p-2">{a.return_date ? `${a.return_date}${a.return_time ? ` @ ${a.return_time}` : ''}` : 'Still out'}</td>
                  <td className="p-2 text-xs text-muted-foreground">{a.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground italic">No apparatus recorded for this period</p>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-sm uppercase tracking-wider mb-2">Deployed Personnel &amp; Overtime Backfill</h4>
        {section.deployments?.length > 0 ? (
          <div className="space-y-3">
            {section.deployments.map(d => (
              <div key={d.deployment_id} className="border rounded-lg overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/30">
                  <div>
                    <span className="font-semibold">{d.personnel_name}</span>
                    <span className="text-muted-foreground text-sm"> · {d.location || 'No location'} · {d.start_date} → {d.end_date || "ongoing"}</span>
                  </div>
                  <span className="text-sm">
                    Backfill: <span className="font-semibold text-yellow-500">{d.backfill_hours} hrs</span> ({d.backfill_shifts} shift{d.backfill_shifts === 1 ? '' : 's'})
                  </span>
                </div>
                {d.backfills.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left p-2 font-medium">Backfill Personnel</th>
                        <th className="text-left p-2 font-medium">Rank</th>
                        <th className="text-left p-2 font-medium">OT Date</th>
                        <th className="text-right p-2 font-medium">Hours</th>
                        <th className="text-left p-2 font-medium">Station</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.backfills.map(b => (
                        <tr key={b.overtime_id} className="border-b border-muted last:border-0">
                          <td className="p-2">{b.personnel_name}</td>
                          <td className="p-2">{b.rank}</td>
                          <td className="p-2">{b.date}</td>
                          <td className="p-2 text-right">{b.hours}</td>
                          <td className="p-2">{b.station_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-3 text-xs text-muted-foreground italic">No overtime backfill recorded</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No {section.deployment_type} deployments in this period</p>
        )}
      </div>
    </div>
  );
};
