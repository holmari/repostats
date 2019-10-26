import {AuthoredTotals, ReceivedTotals, UserResult} from 'types/types';

export function aggregateAuthoredTotals(userResult: UserResult): AuthoredTotals {
  return userResult.repoTotals
    .map((totals) => totals.authoredTotals)
    .reduce<AuthoredTotals>(
      (totals, item) => {
        return {
          approvals: totals.approvals + item.approvals,
          changesCreated: totals.changesCreated + item.changesCreated,
          commentsWritten: totals.commentsWritten + item.commentsWritten,
          rejections: totals.rejections + item.rejections,
          commits: totals.commits + item.commits,
          meanChangeOpenTimeMsec: isNaN(totals.meanChangeOpenTimeMsec)
            ? item.meanChangeOpenTimeMsec
            : (totals.meanChangeOpenTimeMsec + item.meanChangeOpenTimeMsec) / 2,
        };
      },
      {
        approvals: 0,
        changesCreated: 0,
        commentsWritten: 0,
        rejections: 0,
        commits: 0,
        meanChangeOpenTimeMsec: NaN,
      }
    );
}

export function aggregateReceivedTotals(userResult: UserResult): ReceivedTotals {
  return userResult.repoTotals
    .map((totals) => totals.receivedTotals)
    .reduce<ReceivedTotals>(
      (totals, item) => ({
        approvals: totals.approvals + item.approvals,
        rejections: totals.rejections + item.rejections,
        comments: totals.comments + item.comments,
        reviewRequests: totals.reviewRequests + item.reviewRequests,
      }),
      {approvals: 0, rejections: 0, comments: 0, reviewRequests: 0}
    );
}
