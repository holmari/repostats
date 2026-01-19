import './PageTopBar.css';

import React from 'react';

const PageTopBar: React.FC<Props> = ({leftContent, rightContent}) => {
  return (
    <div className="PageTopBar">
      <div className="PageTopBar__left-content">{leftContent}</div>
      <div className="PageTopBar__right-content">{rightContent}</div>
    </div>
  );
};
PageTopBar.displayName = 'PageTopBar';

interface Props {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export default PageTopBar;
