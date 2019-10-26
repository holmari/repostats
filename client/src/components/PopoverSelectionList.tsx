import './PopoverSelectionList.css';

import React from 'react';
import {toggleValue} from 'arrays/utils';

export function defaultItemRenderer<T extends string>(item: T) {
  return item;
}
function PopoverSelectionList<T>({itemRenderer, items, onChange, selectedItems}: Props<T>) {
  return (
    <div className="PopoverSelectionList">
      {items.map((item, index) => (
        <div
          className="PopoverSelectionList__item"
          key={index}
          onClick={() => onChange(toggleValue(selectedItems, item))}
        >
          <input
            className="PopoverSelectionList__item--checkbox"
            type="checkbox"
            checked={selectedItems.includes(item)}
            readOnly
          />
          {itemRenderer(item)}
        </div>
      ))}
    </div>
  );
}
PopoverSelectionList.displayName = 'PopoverSelectionList';

interface Props<T> {
  itemRenderer: (item: T) => React.ReactNode;
  items: ReadonlyArray<T>;
  selectedItems: ReadonlyArray<T>;
  onChange: (selection: ReadonlyArray<T>) => void;
}

export default PopoverSelectionList;
