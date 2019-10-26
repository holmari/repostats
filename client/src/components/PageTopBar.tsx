import './PageTopBar.css';

import React from 'react';

const PageTopBar: React.FC<Props> = ({children, leftContent, rightContent}) => {
  if (children) {
    throw new Error('PageTopBar usage: use leftContent/rightContent, not children');
  }

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
