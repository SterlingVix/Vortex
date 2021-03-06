import Dashlet from '../../controls/Dashlet';
import Icon from '../../controls/Icon';
import { IconButton } from '../../controls/TooltipControls';
import { II18NProps } from '../../types/II18NProps';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';

import { dismissStep } from './actions';
import { IToDo } from './IToDo';

import { TranslationFunction } from 'i18next';
import * as React from 'react';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface ITodoProps {
  t: TranslationFunction;
  todo: IToDo;
  extensionProps: any;
  dismiss: (id: string) => void;
}

class Todo extends React.PureComponent<ITodoProps, {}> {
  public render(): JSX.Element {
    const { t, extensionProps, todo } = this.props;
    const text: JSX.Element = this.resolveElement(todo.text, 'todo-text');
    const value: JSX.Element = this.resolveElement(todo.value, 'todo-value');
    const icon = typeof (todo.icon) === 'string'
      ? <Icon name={todo.icon} />
      : todo.icon(extensionProps);

    return (
      <div
        key={todo.id}
        className={`todo todo-${todo.type}`}
        onClick={this.action}
      >
        {icon}
        {text}
        {value}
        <IconButton
          id={`btn-dismiss-${todo.id}`}
          icon='close-slim'
          tooltip={t('Dismiss')}
          className='btn-embed btn-dismiss'
          value={todo.id}
          onClick={this.dismiss}
        />
      </div>
    );
  }

  private action = () => {
    this.props.todo.action(this.props.extensionProps);
  }

  private dismiss = (evt: React.MouseEvent<any>) => {
    evt.stopPropagation();
    this.props.dismiss(this.props.todo.id);
  }


  private resolveElement(input: string | ((t: TranslationFunction, props: any) => JSX.Element),
                         className: string): JSX.Element {
    const { t, extensionProps } = this.props;
    return input === undefined
      ? null
      : typeof (input) === 'string'
        ? <span className={className}>{t(input)}</span>
        : <div className={className}>{input(t, extensionProps)}</div>;
    }
}

export interface IBaseProps {
  todos: IToDo[];
}

interface IConnectedState {
  dismissAll: boolean;
  steps: { [stepId: string]: boolean };
  extensionProps?: { [id: string]: any };
}

interface IActionProps {
  onDismissStep: (step: string) => void;
}

type IProps = IBaseProps & IConnectedState & IActionProps & II18NProps;

class TodoDashlet extends ComponentEx<IProps, {}> {
  constructor(inProps: IProps) {
    super(inProps);
  }

  public render(): JSX.Element {
    const { t, dismissAll, extensionProps, steps, todos } = this.props;

    if (dismissAll) {
      return null;
    }

    const visibleSteps = todos.filter(
      (step) => {
        if (steps[step.id]) {
          return false;
        }

        if (step.condition !== undefined) {
          const props = extensionProps[step.id];
          return step.condition(props);
        } else {
          return true;
        }
      });

    visibleSteps.sort((lhs, rhs) => (lhs.priority || 100) - (rhs.priority || 100));

    return (
      <Dashlet title={t('Let\'s get you set up')} className='dashlet-todo'>
        <div>
          {visibleSteps.map(todo =>
            <Todo
              t={t}
              key={todo.id}
              todo={todo}
              extensionProps={extensionProps[todo.id]}
              dismiss={this.dismiss}
            />)}
        </div>
      </Dashlet>
    );
  }

  private dismiss = (id: string) => {
    this.props.onDismissStep(id);
  }
}

function mapStateToProps(state: any, ownProps: IBaseProps): IConnectedState {
  const extensionProps: any = {};
  ownProps.todos.forEach(todo => {
    extensionProps[todo.id] = todo.props !== undefined ? todo.props(state) : {};
  });

  return {
    dismissAll: state.settings.firststeps.dismissAll,
    steps: state.settings.firststeps.steps,
    extensionProps,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onDismissStep: (step: string) => dispatch(dismissStep(step)),
  };
}

export default translate(['common'], { wait: true })(
  connect(mapStateToProps, mapDispatchToProps)(
    TodoDashlet)) as React.ComponentClass<IBaseProps>;
