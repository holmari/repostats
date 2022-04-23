import {formatIsoDate} from 'date/utils';
import {ExportToCsv} from 'export-to-csv';

const sum = (acc: number, item: number) => acc + item;

function csvExporter(users: any) {
  let data = users.map((row: any) => {
    return {
      Username: row.displayName,
      'Change Requests': row.repoTotals
        .map((repo: any) => repo.authoredTotals.changesCreated)
        .reduce(sum),
      'Comments Written (All)': row.repoTotals
        .map((repo: any) => repo.authoredTotals.commentsWrittenTotal)
        .reduce(sum),
      'Comments to Others': row.repoTotals
        .map((repo: any) => repo.authoredTotals.commentsWrittenToOthers)
        .reduce(sum),
      'Approvals Given': row.repoTotals
        .map((repo: any) => repo.authoredTotals.approvals)
        .reduce(sum),
      'Rejections Given': row.repoTotals
        .map((repo: any) => repo.authoredTotals.rejections)
        .reduce(sum),
      'Comments Received': row.repoTotals
        .map((repo: any) => repo.receivedTotals.commentsByOthers)
        .reduce(sum),
      'Approvals Received': row.repoTotals
        .map((repo: any) => repo.receivedTotals.approvals)
        .reduce(sum),
      'Rejections Received': row.repoTotals
        .map((repo: any) => repo.receivedTotals.rejections)
        .reduce(sum),
      'Review requests': row.aggregatedReceivedTotals.reviewRequests,
      'Comments / Change': Number.isNaN(
        row.aggregatedReceivedTotals.commentsByOthers / row.aggregatedAuthoredTotals.changesCreated
      )
        ? '-'
        : (
            row.aggregatedReceivedTotals.commentsByOthers /
            row.aggregatedAuthoredTotals.changesCreated
          ).toFixed(3),
      'Comments / Request': Number.isNaN(
        row.aggregatedAuthoredTotals.commentsWrittenToOthers /
          row.aggregatedReceivedTotals.reviewRequests
      )
        ? '-'
        : (
            row.aggregatedAuthoredTotals.commentsWrittenToOthers /
            row.aggregatedReceivedTotals.reviewRequests
          ).toFixed(3),
      'First Seen': formatIsoDate(row.interval?.startDate),
      'Last Seen': formatIsoDate(row.interval?.endDate),
      'Active Days': row.activeDaysCount,
      'Avg. time in review': Math.round(
        row.aggregatedAuthoredTotals.meanChangeOpenTimeMsec / 1000 / 60 / 60
      ),
    };
  });
  const options = {
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalSeparator: '.',
    showLabels: true,
    showTitle: true,
    filename: `codereview-stats.csv`,
    useTextFile: false,
    useBom: true,
    useKeysAsHeaders: true,
  };
  const csvExporter = new ExportToCsv(options);
  csvExporter.generateCsv(data);
}

const ExportCsv = ({users}: any) => {
  return (
    <div className="text-right">
      <button className="btn btn-primary" onClick={() => csvExporter(users)}>
        Export to CSV
      </button>
    </div>
  );
};

export default ExportCsv;
