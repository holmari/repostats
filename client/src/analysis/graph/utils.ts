import {removeDuplicates} from 'arrays/utils';
import {AnalyzeResult, UserResult} from 'types/types';
import {GraphLink, GraphNode} from './types';

export function isIncluded(userId: string, allowedUserIds: ReadonlyArray<string> | null) {
  return !allowedUserIds || allowedUserIds.includes(userId);
}

export function getRelatedUserIds(user: UserResult): ReadonlyArray<string> {
  return removeDuplicates([
    ...Object.keys(user.commentsReceivedByUserId),
    ...Object.keys(user.authoredReviewsByUserId),
    ...Object.keys(user.commentsWrittenByUserId),
    ...Object.keys(user.reviewRequestsAuthoredByUserId),
    ...Object.keys(user.reviewRequestsReceivedByUserId),
    ...Object.keys(user.reviewsReceivedByUserId),
  ]);
}

export function getFullNodeData(
  fullResult: AnalyzeResult,
  allowedUserIds: ReadonlyArray<string> | null
): ReadonlyArray<GraphNode> {
  return Object.keys(fullResult.userResults)
    .filter((userId) => isIncluded(userId, allowedUserIds))
    .map((userId) => ({
      id: userId,
      userResult: fullResult.userResults[userId],
      connectionCount: getRelatedUserIds(fullResult.userResults[userId]).length,
    }));
}

export function getFullLinkData(
  fullResult: AnalyzeResult,
  allowedUserIds: ReadonlyArray<string> | null
): ReadonlyArray<GraphLink> {
  return Object.keys(fullResult.userResults)
    .filter((userId) => isIncluded(userId, allowedUserIds))
    .map((userId) => fullResult.userResults[userId])
    .flatMap((userResult) => {
      const targetUserIds = removeDuplicates([
        ...Object.keys(userResult.commentsWrittenByUserId),
        ...Object.keys(userResult.authoredReviewsByUserId),
      ]).filter((userId) => isIncluded(userId, allowedUserIds));

      return targetUserIds.map((target) => ({
        source: userResult.id,
        target,
        value:
          (userResult.commentsWrittenByUserId[target] || 0) +
          (userResult.authoredReviewsByUserId[target]?.approvals || 0) +
          (userResult.authoredReviewsByUserId[target]?.rejections || 0),
      }));
    });
}
