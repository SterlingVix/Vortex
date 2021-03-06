import {showDialog} from '../../../actions/notifications';
import {IExtensionApi} from '../../../types/IExtensionContext';
import {IState} from '../../../types/IState';
import {UserCanceled} from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { truthy, writeFileAtomic } from '../../../util/util';

import {IDeploymentManifest, ManifestFormat} from '../types/IDeploymentManifest';
import {IDeployedFile, IDeploymentMethod} from '../types/IDeploymentMethod';

import format_1 from './manifest_formats/format_1';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import { getActivator } from './deploymentMethods';

const CURRENT_VERSION = 1;

const formats: { [version: number]: ManifestFormat } = {
  1: format_1,
};

function emptyManifest(instance: string): IDeploymentManifest {
  return {
    version: CURRENT_VERSION,
    instance,
    files: [],
  };
}

/**
 * since the manifest is read from disc, it could have been modified by the user.
 * Check it for correctness
 */
function repairManifest(input: IDeploymentManifest): IDeploymentManifest {
  if (!truthy(input.version)) {
    input.version = CURRENT_VERSION;
  }

  if (!truthy(input.instance)) {
    input.instance = '';
  }

  input.files = input.files.reduce((prev: IDeployedFile[], file: IDeployedFile) => {
    if ((file !== null)
      && (file.relPath !== undefined) && (file.relPath !== null)
      && (file.source !== undefined) && (file.source !== null)
      && (file.time !== undefined) && (file.time !== null)) {
        prev.push(file);
    }
    return prev;
  }, [] as IDeployedFile[]);

  return input;
}

function readManifest(data: string): IDeploymentManifest {
  if (data === '') {
    return undefined;
  }
  let parsed = JSON.parse(data);
  let lastVersion = 0;
  while (lastVersion < CURRENT_VERSION) {
    parsed = formats[parsed.version || 1](parsed);
    if ((parsed.version === lastVersion) && (parsed.version < CURRENT_VERSION)) {
      // this should not happen!
      throw new Error(`unsupported format upgrade ${parsed.version} -> ${CURRENT_VERSION}`);
    }
    lastVersion = parsed.version;
  }
  if (parsed.files === undefined) {
    parsed.files = [];
  }
  return repairManifest(parsed);
}

function fallbackPurge(basePath: string,
                       files: IDeployedFile[]): Promise<void> {
  return Promise.map(files, file => {
    const fullPath = path.join(basePath, file.relPath);
    return fs.statAsync(fullPath).then(
      stats => (stats.mtime.getTime() === file.time)
        ? fs.unlinkAsync(fullPath)
        : Promise.resolve())
    .catch(err => {
      if (err.code !== 'ENOENT') {
        return Promise.reject(err);
      } // otherwise ignore
    });
  })
  .then(() => undefined);
}

function queryPurgeTextSafe(t: I18next.TranslationFunction) {
  return t('IMPORTANT: This game was modded by another instance of Vortex.\n\n' +
      'If you switch between different instances (or between shared and ' +
      'single-user mode) it\'s better if you purge mods before switching.\n\n' +
      'Vortex can try to clean up now but this is less reliable (*) than doing it ' +
      'from the instance that deployed the files in the first place.\n\n' +
      'If you modified any files in the game directory you should back them up ' +
      'before continuing.\n\n' +
      '(*) This purge relies on a manifest of deployed files, created by that other ' +
      'instance. Files that have been changed since that manifest was created ' +
      'won\'t be removed to prevent data loss. If the manifest is damaged or ' +
      'outdated the purge may be incomplete. When purging from the "right" instance ' +
      'the manifest isn\'t required, it can reliably deduce which files need to ' +
      'be removed.');
}

function queryPurgeTextUnsafe(t: I18next.TranslationFunction) {
  return t('IMPORTANT: This game was modded by another instance of Vortex.\n\n' +
      'Vortex can only proceed by purging the mods from that other instance.\n\n' +
      'This will irreversably **destroy** the mod installations from that other ' +
      'instance!\n\n' +
      'You should instead cancel now, open that other vortex instance and purge ' +
      'from there. This can also be caused by switching between shared and ' +
      'single-user mode.');
}

function queryPurge(api: IExtensionApi,
                    basePath: string,
                    files: IDeployedFile[],
                    safe: boolean): Promise<void> {
  const t = api.translate;
  const text = safe ? queryPurgeTextSafe(t) : queryPurgeTextUnsafe(t);
  return api.store.dispatch(showDialog('info', t('Purge files from different instance?'), {
    text,
  }, [ { label: 'Cancel' }, { label: 'Purge' } ]))
    .then(result => {
      if (result.action === 'Purge') {
        return fallbackPurge(basePath, files)
          .catch(err => {
            api.showErrorNotification('Purging failed', err, {
              allowReport: false,
            });
            return Promise.reject(new UserCanceled());
          });
      } else {
        return Promise.reject(new UserCanceled());
      }
    });
}

export function loadActivation(api: IExtensionApi, modType: string,
                               modPath: string, activator: IDeploymentMethod): Promise<IDeployedFile[]> {
  if (modPath === undefined) {
    return Promise.resolve([]);
  }
  const typeTag = (modType !== undefined) && (modType.length > 0) ? modType + '.' : '';
  const tagFile = path.join(modPath, `vortex.deployment.${typeTag}json`);
  const state: IState = api.store.getState();
  const instanceId = state.app.instanceId;
  return fs.readFileAsync(tagFile, 'utf8')
      .then(data => readManifest(data))
      .catch(err => {
        if (err.code === 'ENOENT') {
          return emptyManifest(instanceId);
        }
        return Promise.reject(
          new Error(`${err.message}.\n*** When you report this, `
                    + `please include the file "${tagFile} ***"`));
      })
      .then(tagObject => {
        if (tagObject === undefined) {
          tagObject = emptyManifest(instanceId);
        }

        let result: Promise<IDeployedFile[]>;
        if ((tagObject.instance !== instanceId) && (tagObject.files.length > 0)) {
          let safe = true;
          if (tagObject.deploymentMethod !== undefined) {
            const previousActivator = getActivator(tagObject.deploymentMethod);
            if ((previousActivator !== undefined) && !previousActivator.isFallbackPurgeSafe) {
              safe = false;
            }
          }
          result = queryPurge(api, modPath, tagObject.files, safe)
              .then(() => saveActivation(modType, state.app.instanceId, modPath, [], activator.id))
              .then(() => Promise.resolve([]));
        } else {
          result = Promise.resolve(tagObject.files);
        }
        return result;
      });
}

export function saveActivation(modType: string, instance: string,
                               gamePath: string, activation: IDeployedFile[],
                               activatorId: string) {
  const typeTag = (modType !== undefined) && (modType.length > 0) ? modType + '.' : '';
  const tagFile = path.join(gamePath, `vortex.deployment.${typeTag}json`);
  const data = JSON.stringify({
    instance,
    version: CURRENT_VERSION,
    deploymentMethod: activatorId,
    files: activation
  }, undefined, 2);
  try {
    JSON.parse(data);
  } catch (err) {
    return Promise.reject(
      new Error(`failed to serialize deployment information: "${err.message}"`));
  }
  return (activation.length === 0)
    ? fs.removeAsync(tagFile).catch(() => undefined)
    : writeFileAtomic(tagFile, data);
}
