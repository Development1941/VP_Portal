import { uploadSowSheetAction } from "@/app/actions";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { SowEditRow } from "@/components/dashboard/row-edit";
import { AddSowEntry } from "@/components/sheets/add-entry";
import { sowLink } from "@/components/sheets/cells";
import type { SowRecord } from "@/lib/types";

export function SowStatusBoard({ records, editable }: { records: SowRecord[]; editable: boolean }) {
  const sowStatus = records.filter((row) => row.kind === "status");
  const sowBids = records.filter((row) => row.kind === "bid");
  return (
    <section className="card status-board" id="sow-status">
      <div className="card-head">
        <div>
          <h2>SOW status</h2>
          <span className="muted">Signed statements of work, open bids, and addenda</span>
        </div>
        {editable ? (
          <div className="sheet-actions">
            <AddSowEntry kind="status" />
            <SheetUpload
              action={uploadSowSheetAction}
              button="Upload SOW"
              title="Upload SOW"
              hint="Use an Excel or CSV file. New rows are appended and matching rows (same project and sprint) are updated. Nothing is removed."
              field="sow"
            />
          </div>
        ) : null}
      </div>
      {sowStatus.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>S.no</th>
                <th>Project</th>
                <th>Sprint</th>
                <th>Link</th>
                <th>Signed</th>
                <th>Signed on</th>
                <th>CR / Addendum</th>
                {editable ? <th>Edit</th> : null}
              </tr>
            </thead>
            <tbody>
              {sowStatus.map((row) =>
                editable ? (
                  <SowEditRow key={row.id} row={row} />
                ) : (
                  <tr key={row.id}>
                    <td className="num">{row.sheetNo || "—"}</td>
                    <td>{row.project}</td>
                    <td>{row.sprint || "—"}</td>
                    <td>{sowLink(row.link)}</td>
                    <td>{row.signature ? <span className={`badge ${row.signature.toLowerCase() === "signed" ? "ok" : "warn"}`}>{row.signature}</span> : "—"}</td>
                    <td className="num">{row.signedOn || "—"}</td>
                    <td className="remarks">{row.changeRequest || "—"}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No SOW status has been recorded.</p>
      )}
      {sowBids.length || editable ? (
        <>
          <div className="card-head sow-bids-head">
            <h3>SOW bids</h3>
            {editable ? <AddSowEntry kind="bid" /> : null}
          </div>
          {sowBids.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>S.no</th>
                    <th>Project</th>
                    <th>Reference link</th>
                    {editable ? <th>Edit</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sowBids.map((row) =>
                    editable ? (
                      <SowEditRow key={row.id} row={row} />
                    ) : (
                      <tr key={row.id}>
                        <td className="num">{row.sheetNo || "—"}</td>
                        <td>{row.project}</td>
                        <td>{sowLink(row.link)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No SOW bids yet.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
