'use babel';

import SampleEngine from './sample-engine';
import {default as pkgMngr, PKG_STATUS} from './helper/package-manager';

/**
 * The main file is responsible for initialize and subscribe this plugin to the dbex atom module
 */
export default {
  activate() {
    const dbexCoreStatus = pkgMngr.packageStatus('dbex');

    if (dbexCoreStatus === PKG_STATUS.notPresent || dbexCoreStatus === PKG_STATUS.disabled) {
      pkgMngr.enablePackage('dbex', true, 'Dbex MySQL Engine');
    }
  },

  /**
   * subscribes to the dbex service
   * @return {callable} a callable instance of the engine
   */
  subscribePlugin() {
    return (logger)=>new SampleEngine(logger);
  },
};
