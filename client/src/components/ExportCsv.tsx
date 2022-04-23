import { ExportToCsv } from "export-to-csv"

function csvExporter(user: any) {
    const data = [
        {
            displayName: user.displayName,
            approvals: user.aggregatedAuthoredTotals.approvals,
            rejections: user.aggregatedAuthoredTotals.rejections,
            totalComments: user.aggregatedAuthoredTotals.commentsWrittenTotal,
            commentsToOthers: user.aggregatedAuthoredTotals.commentsWrittenToOthers,
            changeRequests: user.aggregatedAuthoredTotals.changesCreated,
            commits: user.aggregatedAuthoredTotals.commits,
            averageTimeInReview: user.aggregatedAuthoredTotals.meanChangeOpenTimeMsec,
            commentsPerRequest: user.aggregatedAuthoredTotals.commentsWrittenToOthers / user.aggregatedReceivedTotals.reviewRequests,
          },
        // "test",
    ];
    const options = { 
        fieldSeparator: ',',
        quoteStrings: '"',
        decimalSeparator: '.',
        showLabels: true, 
        showTitle: true,
        title: 'User Code Review Stats',
        filename: `${user.displayName}-stats.csv`,
        useTextFile: false,
        useBom: true,
        useKeysAsHeaders: true,
      };
    const csvExporter = new ExportToCsv(options);
    csvExporter.generateCsv(data);
}

const ExportCsv = ( {user} : any ) => {

    return (
        <div className="text-right">
            <button className="btn btn-primary" onClick={() => csvExporter(user)}>
                Export to CSV
            </button>
        </div>
    )
}


export default ExportCsv;