import './SidebarList.css';

import classNames from 'classnames';
import React from 'react';
import Button from 'react-bootstrap/Button';
import {NavLink} from 'react-router-dom';

function SidebarList<T>(props: Props<T>) {
  const content = props.items.length ? (
    props.items.map((item, index) => (
      <React.Fragment key={index}>
        {props.itemRenderer({item, index, className: 'SidebarList__item'})}
      </React.Fragment>
    ))
  ) : (
    <div className="SidebarList__empty-state">
      <p>No content found.</p>
    </div>
  );

  return (
    <div className={classNames('SidebarList', props.className)}>
      {props.isHeaderVisible && (
        <div className="SidebarList__header">
          {!!props.addLink && (
            <NavLink to={props.addLink}>
              <Button>New…</Button>
            </NavLink>
          )}
        </div>
      )}
      <div className="SidebarList__content">
        {content}
        <div className="SidebarList__content--spacer" />
      </div>
    </div>
  );
}
SidebarList.displayName = 'SidebarList';
SidebarList.defaultProps = {
  isHeaderVisible: true,
};

export interface SidebarItemRendererProps<T> {
  className: string;
  item: T;
  index: number;
}
interface Props<T> {
  addLink?: string;
  className?: string;
  isHeaderVisible?: boolean;
  items: ReadonlyArray<T>;
  itemRenderer: React.FC<SidebarItemRendererProps<T>>;
}

export default SidebarList;
