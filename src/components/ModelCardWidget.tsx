/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/camelcase */
import { ReactWidget } from '@jupyterlab/apputils';
import { INotebookModel, Notebook } from '@jupyterlab/notebook';
import { Button, Input, Typography } from 'antd';
import 'antd/dist/antd.css';
import { enableMapSet } from 'immer';
import clone from 'lodash/clone';
import React, { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { useImmer } from 'use-immer';
import { stages } from '../constants';
import { generateModelCard } from '../lib/model-card-generator/main';
import { AnnotMap, getAnnotMap } from '../util/mdExtractor';
import { jumpToCell } from '../util/notebook_private';
import QuickFix from './QuickFix';
const { Title } = Typography;
const { TextArea } = Input;

enableMapSet();

interface IProps {
  model: INotebookModel;
  notebook: Notebook;
}

interface ISectionProps {
  notebook: Notebook;
}

interface ISectionContent {
  notebook: Notebook;
  sectionContent: any;
  quickFix: React.ReactNode;
}

const ignoreFields = new Set([
  'lineNumbers',
  'markdown',
  'source',
  'misc',
  'cells',
  'fileName'
]);

const getJumpIndex = (sectionName: string, sectionContent: any): number => {
  if (sectionName === 'author') {
    return 1;
  }
  // if it's a stage, jump to the top cell if existed
  if (stages.has(sectionName) && sectionContent['cell_ids'].length > 0) {
    return sectionContent['cell_ids'][0];
  }
  // otherwise insert to bottom
  return Infinity;
};

const SectionContent = ({
  notebook,
  sectionContent,
  quickFix
}: ISectionContent): React.ReactNode =>
  typeof sectionContent !== 'object'
    ? null
    : Object.entries(sectionContent).map(([k, v]: [string, any], idx) => {
        if (ignoreFields.has(k)) {
          return null;
        }
        if (k === 'title') {
          return (
            <h1 key={idx}>
              {v} {quickFix}
            </h1>
          );
        } else if (k === 'cell_ids') {
          return v.map((cid: number, idx: number) => (
            <Button key={idx} onClick={() => jumpToCell(notebook, cid)}>
              {cid}
            </Button>
          ));
        } else if (k === 'figures') {
          return v.map((src: string, idx: number) => (
            <img key={idx} src={`data:image/png;base64,${src}`} />
          ));
        } else {
          return (
            <React.Fragment key={idx}>
              {v.length === 0 ? (
                ''
              ) : (
                <>
                  {k === 'description' ? null : <h2>{k}</h2>}
                  <p>{v}</p>
                </>
              )}
            </React.Fragment>
          );
        }
      });

const Section: React.FC<ISectionProps> = ({ notebook }) => {
  const [annotMap, updateAnnotMap] = useImmer(new Map() as AnnotMap);
  const [data, updateData] = useState({});

  useEffect(() => {
    // console.log('updated map', amap);
    const amap = getAnnotMap(notebook);
    console.log(amap);
    updateAnnotMap(() => amap);
    const modelCard: any = generateModelCard(notebook.model.toJSON());

    amap.forEach((value, key) => {
      if (key in data) {
        modelCard[key]['description'] = value.content;
      }
    });
    console.log(modelCard);
    updateData(modelCard);
  }, [notebook]);

  return (
    <>
      {Object.entries(data).map(([sectionName, sectionContent]) =>
        SectionContent({
          notebook,
          sectionContent,
          quickFix: (
            <QuickFix
              sectionName={sectionName}
              sectionTitle={sectionContent['title']}
              annotMap={annotMap}
              updateAnnotMap={updateAnnotMap}
              notebook={notebook}
              idx={getJumpIndex(sectionName, sectionContent)} // TODO find the right index
            />
          )
        })
      )}
    </>
  );
};

export class ModelCardWidget extends ReactWidget {
  /** Data in the current notebook */
  private _notebook: Notebook;

  constructor(notebook: Notebook) {
    super();
    this._notebook = notebook;
    this.addClass('jp-ReactWidget');
  }

  // rerender the component every time the command is executed
  onUpdateRequest(): void {
    ReactDOM.render(<Section notebook={this._notebook} />, this.node);
  }

  updateModel(notebook: Notebook): void {
    this._notebook = clone(notebook);
  }

  render(): JSX.Element {
    return <Section notebook={this._notebook} />;
  }
}
