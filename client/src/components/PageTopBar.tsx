import './PageTopBar.css';

import classNames from 'classnames';
import React from 'react';

const PageTopBar: React.FC<Props> = ({leftContent, rightContent, variant = 'dark'}) => {
  return (
    <div className={classNames('PageTopBar', variant === 'light' && 'PageTopBar--light')}>
      <div className="PageTopBar__left-content">{leftContent}</div>
      <div className="PageTopBar__right-content">{rightContent}</div>
    </div>
  );
};
PageTopBar.displayName = 'PageTopBar';

interface Props {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  variant?: 'dark' | 'light';
}

export default PageTopBar;
