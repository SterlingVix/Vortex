import { Archive } from '../util/archives';

import { INotification } from './INotification';
import { ITableAttribute } from './ITableAttribute';
import { ITestResult } from './ITestResult';
import * as Promise from 'bluebird';
import { IModInfo, IReference } from 'modmeta-db';
import * as React from 'react';

export type PropsCallback = () => Object;

/**
 * determines where persisted state is stored and when it gets loaded.
 * global: global NMM2 state, loaded on startup
 * game: state regarding the managed game. Will be swapped out when the game mode changes
 * profile: state regarding the managed profile. Will be swapped out when the profile changes
 */
export type PersistingType = 'global' | 'game' | 'profile';

export type CheckFunction = () => Promise<ITestResult>;

export interface IRegisterSettings {
  (title: string, element: React.ComponentClass<any>, props?: PropsCallback): void;
}

export interface IRegisterIcon {
  (group: string,
   icon: string | React.ComponentClass<any> | React.StatelessComponent<any>,
   title?: string | PropsCallback,
   action?: (instanceIds: string[]) => void): void;
}

export interface IRegisterFooter {
  (id: string, element: React.ComponentClass<any>, props?: PropsCallback): void;
}

export interface IMainPageOptions {
  hotkey?: string;
  visible?: () => boolean;
  props?: () => any;
}

export interface IRegisterMainPage {
  (icon: string, title: string, element: React.ComponentClass<any>,
   options: IMainPageOptions): void;
}

export interface IRegisterDashlet {
  (title: string, width: 1 | 2 | 3, position: number,
    component: React.ComponentClass<any>, isVisible?: (state) => boolean,
    props?: PropsCallback): void;
}

export interface IRegisterDialog {
  (id: string, element: React.ComponentClass<any>, props?: PropsCallback): void;
}

export interface IRegisterProtocol {
  (protocol: string, callback: (url: string) => void);
}

export interface IFileFilter {
  name: string;
  extensions: string[];
}

export interface IOpenOptions {
  title?: string;
  defaultPath?: string;
  filters?: IFileFilter[];
}

export interface IStateChangeCallback {
  (previous: any, current: any): void;
}

/**
 * additional detail to further narrow down which file is meant
 * in a lookup
 * 
 * @export
 * @interface ILookupDetails
 */
export interface ILookupDetails {
  filePath?: string;
  fileMD5?: string;
  fileSize?: number;
  gameId?: string;
  modId?: string;
}

/**
 * a persistor is used to hook a data file into the store.
 * This way any data file can be made available through the store and
 * updated through actions, as long as it can be represented in json
 * 
 * @export
 * @interface IPersistor
 */
export interface IPersistor {
  /**
   * called once the persistor is hooked up and active. The persistor can call this
   * if data has changed outside the application and the store will rehydrate with the
   * new data
   * 
   * @param {() => void} cb
   * 
   * @memberOf IPersistor
   */
  setResetCallback(cb: () => void): void;
  getItem(key: string, cb: (error: Error, result?: string) => void): void;
  setItem(key: string, value: string | number, cb: (error: Error) => void): void;
  removeItem(key: string, cb: (error: Error) => void): void;
  getAllKeys(cb: (error: Error, keys?: string[]) => void): void;
}

/**
 * options that can be passed to archive handler on opening
 */
export interface IArchiveOptions {
  // if set, the archive should be integrity-checked on loading (i.e. crc checks) if possible
  // whether this is supported and how much it slows down loading depends on the file type.
  verify?: boolean;
}

/**
 * interface for archive handlers, exposing files inside archives to to other extensions
 * 
 * @export
 * @interface IArchiveHandler
 */
export interface IArchiveHandler {
  readDir(archPath: string): Promise<string[]>;
  readFile(filePath: string): NodeJS.ReadableStream;
  extractFile(filePath: string, outputPath: string): Promise<void>;
  extractAll(outputPath: string): Promise<void>;
}

export interface IArchiveHandlerCreator {
  (fileName: string, options: IArchiveOptions): Promise<IArchiveHandler>;
}

/**
 * interface for convenience functions made available to extensions 
 * 
 * @export
 * @interface IExtensionApi
 */
export interface IExtensionApi {
  /**
   * show a notification to the user.
   * This is not available in the call to registerReducer
   * 
   * @type {INotification}
   * @memberOf IExtensionApi
   */
  sendNotification?: (notification: INotification) => void;

  /**
   * show an error message to the user.
   * This is a convenience wrapper for sendNotification.
   * This is not available in the call to registerReducer
   * 
   * @memberOf IExtensionApi
   */
  showErrorNotification?: (message: string, detail: string | Error | any, isHTML?: boolean) => void;

  /**
   * hides a notification by its id
   * 
   * @memberOf IExtensionApi
   */
  dismissNotification?: (id: string) => void;

  /**
   * show a system dialog to open a single file
   * 
   * @memberOf IExtensionApi
   */
  selectFile: (options: IOpenOptions) => Promise<string>;

  /**
   * show a system dialog to select an executable file
   * 
   * @memberOf IExtensionApi
   */
  selectExecutable: (options: IOpenOptions) => Promise<string>;

  /**
   * show a system dialog to open a single directory
   * 
   * @memberOf IExtensionApi
   */
  selectDir: (options: IOpenOptions) => Promise<string>;

  /**
   * the redux store containing all application state & data
   *
   * Please note: this store object will remain valid for the whole
   *   application runtime so you can store it, bind it to functions
   *   and so on. The state object (store.getState()) is immutable and
   *   will be a different object whenever the state is changed.
   *   Thus you should *not* store/bind the state directly unless you
   *   actually want a "snapshot" of the state.
   * 
   * @type {Redux.Store<any>}
   * @memberOf IExtensionApi
   */
  store?: Redux.Store<any>;

  /**
   * event emitter
   * 
   * @type {NodeJS.EventEmitter}
   * @memberOf IExtensionApi
   */
  events: NodeJS.EventEmitter;

  /**
   * translation function
   */
  translate: I18next.TranslationFunction;

  /**
   * retrieve path for a known directory location.
   * 
   * Note: This uses electrons ids for known folder locations.
   * Please write your extensions to always use the appropriate
   * folder location returned from this function, especially
   * 'userData' should be used for all settings/state/temporary data
   * if you don't want to/can't use the store.
   * If NMM2 introduces a way for users to customise storage locations
   * then getPath will return the customised path so you don't have to
   * adjust your extension.
   * 
   * @type {Electron.AppPathName}
   * @memberOf IExtensionApi
   */
  getPath: (name: Electron.AppPathName) => string;

  /**
   * register a callback for changes to the state
   * 
   * @param {string[]} path path in the state-tree to watch for changes,
   *                   i.e. [ 'settings', 'interface', 'language' ] would call the callback
   *                   for all changes to the interface language  
   * 
   * @memberOf IExtensionApi
   */
  onStateChange?: (path: string[], callback: IStateChangeCallback) => void;

  /**
   * registers an uri protocol to be handled by this application
   * 
   * @type {IRegisterProtocol}
   * @memberOf IExtensionContext
   */
  registerProtocol: IRegisterProtocol;

  /**
   * deregister an uri protocol currently being handled by us
   * 
   * @memberOf IExtensionApi
   */
  deregisterProtocol: (protocol: string) => void;

  /**
   * find meta information about a mod
   * 
   * @memberOf IExtensionApi
   */
  lookupModReference: (ref: IReference) => Promise<ILookupDetails[]>;

  /**
   * find meta information about a mod
   * this will calculate a hash and the file size of the specified file
   * for the lookup unless those details are already provided.
   * Please note that it's still possible for the file to get multiple
   * matches, i.e. if it has been re-uploaded, potentially for a different
   * game.
   * 
   * @memberOf IExtensionApi
   */
  lookupModMeta: (details: ILookupDetails) => Promise<ILookupDetails[]>;

  /**
   * save meta information about a mod
   * 
   * @memberOf IExtensionApi
   */
  saveModMeta: (modInfo: IModInfo) => Promise<void>;

  /**
   * opens an archive
   */
  openArchive: (archivePath: string) => Promise<Archive>;
}

/**
 * specification a reducer registration has to follow.
 * defaults must be an object with the same keys as
 * reducers
 * 
 * @export
 * @interface IReducerSpec
 */
export interface IReducerSpec {
  reducers: { [key: string]: (state: any, payload: any) => any };
  defaults: { [key: string]: any };
}

/**
 * The extension context is an object passed into all extensions during initialisation.
 * 
 * There are three main parts to this object:
 * a) api. This is an object that contains various functions and objects to interact with the
 *    main application. During runtime of the application (that is: after the startup phase)
 *    this will be the only part of the context object you need.
 *    Most importantly it gives you access to the application store (maintaining all state)
 *    and a bunch of "stateful" convenience functions (stuff like displaying notifications/
 *    dialogs in a way consistent with the remaining application).
 * b) register functions. These must be called immediately inside the init function and they
 *    "inject" your extension functionality into the main function. That is: you register ui
 *    controls, callbacks, ... and the main function will then use that as necessary.
 *    Please note that a call to a register function has no immediate effect, those calls are
 *    stored and evaluated once all extensions have been initialised.
 *    An extension can add new register functions by simply assigning to the context object.
 *    These functions are then available to all other extensions, the order in which extensions
 *    are loaded is irrelevant (and can't be controlled).
 *    If an extension uses a register function from another extension it becomes implicitly
 *    dependent on it. If the register function isn't available (because that other extension
 *    isn't installed) the dependent extension isn't loaded either.
 *    To avoid this, call context.optional.registerXYZ(). Such a call will be evaluated if possible
 *    but won't cause an error if it isn't.
 *    Please note that context is a "Proxy" object that will accept calls to any "registerXYZ"
 *    function no matter if it's available or not. You can't "introspect" this object reliably,
 *    it will not show the available register functions.
 * c) once-callback. This is a callback that will be run after all extensions have been initialized
 *    and all register functions have been evaluated. This is still *before* a gamemode has been
 *    activated so you can't access game-specific data immediately inside once.
 *    It will be called only once at application startup whereas init is called once per process
 *    (that is: twice in total). It should be used for all your extension setup except for the
 *    register calls (i.e. installing event handlers, doing startup calculations).
 *    This is because at the time once is called, the context.api
 *    object is fully initialised and once is only caused if your extension should really load
 *    (as in: it's compatible with the current api).
 */
export interface IExtensionContext {
  /**
   * register a settings page
   * 
   * @type {IRegisterSettings}
   * @memberOf IExtensionContext
   */
  registerSettings: IRegisterSettings;

  /**
   * register a toolbar icon
   * 
   * @type {IRegisterIcon}
   * @memberOf IExtensionContext
   */
  registerIcon: IRegisterIcon;

  /**
   * registers a page for the main content area
   * 
   * @type {IRegisterMainPage}
   * @memberOf IExtensionContext
   */
  registerMainPage: IRegisterMainPage;

  /**
   * register a dashlet to be displayed on the welcome screen
   */
  registerDashlet: IRegisterDashlet;

  /**
   * register a dialog (or any control that is rendered independent of the main content area
   * really)
   * This dialog has to control its own visibility
   */
  registerDialog: IRegisterDialog;

  /**
   * registers a element to be displayed in the footer
   * 
   * @type {IRegisterFooter}
   * @memberOf IExtensionContext
   */
  registerFooter: IRegisterFooter;

  /**
   * register a reducer to introduce new set-operations on the application
   * state.
   * Note: For obvious reasons this is executed before the store is set up so
   * many api operations are not possible during this call
   * 
   * The first part of the path decides how and if state persisted:
   *   * window, settings, persistent are always persisted and automatically restored
   *   * session and all other will not be persisted at all. Although session is not
   *     treated different than any other path, please use this path  for all
   *     ephemeral state
   *
   * Another word on the path: You can introduce additional reducers for any "leaf" of
   *   the settings tree and you can introduce new "subnodes" in the tree at any depth.
   *   For technical reasons it is however not possible to introduce subnodes to a leaf
   *   or vice-versa.
   *   I.e. settings.interface contains all settings regarding the ui. Your extension
   *   can register a reducer with path ['settings', 'interface'] and ['settings', 'whatever']
   *   but not ['settings'] and not ['settings', 'interface', 'somethingelse']
   *
   * And one more thing about the spec: All things you store inside the store need to be
   *   serializable. This means: strings, numbers, booleans, arrays, objects are fine but
   *   functions are not. If you absolutely need to store a callback or something then create
   *   a "registry" or factory and store just an id that allows you to retrieve or generate
   *   the function on demand. 
   * 
   * @param {string[]} path The path within the settings store
   * @param {IReducerSpec} spec a IReducerSpec object that contains reducer functions and defaults
   *        for the newly introduced settings
   * 
   * @memberOf IExtensionContext
   */
  registerReducer: (path: string[], spec: IReducerSpec) => void;

  /**
   * register a hive in the store to be persisted. A hive is a top-level branch in the state,
   * like "settings", "state", ...
   * You must not register a hive that is already being persisted or you get data inconsistency.
   * Do not use this on a hive that is registered with "registerPersistor". With this function,
   * NMM2 takes care of storing/restoring the data, with registerPersistor you can customize the
   * file format.
   * 
   * @param {PersistingType} type controls where the state is stored and when it is loaded
   * @param {string} hive the top-level key inside the state.
   *
   * @memberOf IExtensionContext
   */
  registerSettingsHive: (type: PersistingType, hive: string) => void;

  /**
   * register a new persistor that will hook a data file into the application store.
   * @param {string} hive the top-level key inside the state that this persistor will add
   *                      it's data to. We can't add persistors inside an existing node (
   *                      technical reasons) but you can implement an aggregator-persistor
   *                      that syncs sub-nodes with different files
   * @param {IPersistor} persistor the persistor. Adhere to the interface and it should be fine
   * @param {number} debounce this value (in milliseconds) determins how frequent the file will
   *                          be updated on disk. Higher values reduce load and disk activity
   *                          but more data could be lost in case of an application crash.
   *                          Defaults to 200 ms
   * 
   * @memberOf IExtensionContext
   */
  registerPersistor: (hive: string, persistor: IPersistor, debounce?: number) => void;

  /**
   * register a stylesheet file to be loaded in the page
   * This is expected to be a less file and it will be compiled to css at startup
   * time together will all other extensions and variables.less. This means you can
   * access all the variables defined there.
   * 
   * @memberOf IExtensionContext
   */
  registerStyle: (filePath: string) => void;

  /**
   * add an attribute to a table. An attribute can appear as a column inside the table or as a
   * detail field in the side panel.
   * The tableId identifies, obviously, the table to which the attribute should be added. Please
   * find the right id in the documentation of the corresponding extension
   */
  registerTableAttribute: (tableId: string, attribute: ITableAttribute) => void;

  /**
   * add a check that will automatically be run on the specified event.
   * Such checks can be used by extensions to check the integrity of their own data, of the
   * application setup or that of the game and present them to the user in a common way.
   * 
   * @memberOf IExtensionContext
   */
  registerTest: (id: string, event: string, check: CheckFunction) => void;

  /**
   * register a handler for archive types so the content of such archives is exposed to
   * the application (especially other extensions)
   * 
   * @memberOf IExtensionContext
   */
  registerArchiveType: (extension: string, handler: IArchiveHandlerCreator) => void;

  /**
   * called once after the store has been set up and after all extensions have been initialized
   * This means that if your extension registers its own extension function
   * (@see registerExtensionFunction) then those registrations happen before once is called.
   * 
   * You shouldn't make assumptions on the order in which extensions are loaded and on them to be
   * loaded synchronously, so if you have initialization code that requires another extension to
   * be initialized first, you should check if that happened already in your "once" call and react
   * to some sort of event that would indicate that other initialization to be finished (usually
   * a state change)
   * 
   * @memberOf IExtensionContext
   */
  once: (callback: () => void) => void;

  /**
   * similar to once but this callback will be run (only) on the electron "main" process.
   * Use this only if you absolutely must (if you don't know what electron main process means, it's
   * almost certain you don't want this).
   * While almost all program logic of NMM2 runs in the renderer process, some libraries will not
   * work correctly on that process so you have to run on the main process.
   */
  onceMain: (callback: () => void) => void;

  /**
   * contains various utility functions. It's valid to store this object inside
   * the extension for later use.
   * 
   * @type {IExtensionApi}
   * @memberOf IExtensionContext
   */
  api: IExtensionApi;

  /**
   * proxy to make optional register calls (if such calls are invalid in the api the extension
   * will not be unloaded)
   */
  optional: any;
}
