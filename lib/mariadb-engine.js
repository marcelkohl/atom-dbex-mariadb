'use babel';

import ConnectionSettings from './dataModel/connection-settings';
import FieldConnection from './dataModel/field-connection';
import {default as ResultSet} from './dataModel/result-set';
import mariadb from 'mariadb';
import database from './domain/database';
import table from './domain/table';
import view from './domain/view';
import func from './domain/func';
import proc from './domain/proc';
import trigger from './domain/trigger';
import generalEvents from './domain/general-events';
import fieldType from './domain/field-type';

const POOL_NOT_EXIST = 'Pool Not Exist';

/**
 * Sample Engine exemplifies the essential methods that a custom dbex engine
 * must have and how to interact and respond to the requests.
 */
export default class MariaDbEngine {
  /**
   * @param {Logger} logger Logger instance from dbex.
   */
  constructor(logger) {
    this.logger = logger;
    this.pools = {};
    this.running = {};
  }

  /**
   * This method is used when dbex needs to change the scope of logger.
   * Don't worry about how it works, dbex does all the job but this method must be available.
   *
   * @return {Logger}
   */
  getLogger() {
    return this.logger; // leave like this and everything is fine for this method.
  }

  /**
   * Engine name getter.
   *
   * @return {string} a name given to your engine.
   */
  getName() {
    return "marcelkohl-mariadb"; //  Be creative to not get conflicted by other author's names
  }

  /**
   * Engine icon getter.
   * Must be a css class that represents an icon for the connections created with this engine.
   * Take a look on the styles/style.less for more details.
   *
   * @return {string}
   */
  getIconClass() {
    return "mariadb-engine-icon";
  }

  /**
   * Connection settings are used to specify the fields needed to make the connection.
   * All the fields in this list will come later on future requests.
   * @return {ConnectionSettings}
   */
  getConnectionSettings() {
    return new ConnectionSettings({
      name: this.getName(),
      label: "MariaDB",
      custom: [
        new FieldConnection({id: 'host', title: "Host", tip:"Hostname or IP address without port"}),
        new FieldConnection({id: 'port', title: "Port", tip:"Only numbers"}),
        new FieldConnection({id: 'user', title: "User"}),
        new FieldConnection({id: 'password', title: "Password"}),
        new FieldConnection({id: 'database', title: "Database", tip: "Optional"}),
        // new FieldConnection({id: 'ssl', title: "Use SSL", tip: "Default is to not use", isBool:true}),
      ]
    });
  }

  /**
   * Called when the user requests to test the connection on the create connection window.
   *
   * @param  {object}   connectionCustomFields  A list of key:value objects containing the fields provided on getConnectionSettings
   * @param  {callable} onConnect               A callable used when the connection works
   * @param  {callable} onFail                  A callable used when the connection failed
   */
  testConnection(connectionCustomFields, onConnect, onFail) {
    let ccf = connectionCustomFields;

    if (ccf.host.length > 0 && ccf.port.length > 0 && ccf.user.length > 0) {
      this._connect(ccf).then((pool)=>{
        pool.getConnection().then(
          (connection)=>{
            onConnect("success");
            connection.release();
          }
        ).catch(err=>{
          onFail(err || "Failed to connect");
          return;
        });
      });
    } else {
      onFail("Some necessary fields are not filled. Please check again");
    }
  }

  _connect(connectionFields) {
    return new Promise((resolve) => {
      let config = {
        host: connectionFields.host,
        user: connectionFields.user,
        password: connectionFields.password,
        port: connectionFields.port,
        database: connectionFields.database || "",
        multipleStatements: false
      }

      resolve(mariadb.createPool(config));
    });
  }

  /**
   * Resolve double clicks from dbex.
   * This methos is called when the user clicks any element under this engine settings.
   * @param  {string}   connectionName Reference for the user's connection
   * @param  {object}   datasets       A list of key:value objects containing the fields provided on getConnectionSettings
   * @param  {callable} onDone         A callable used when the processing is done. onDone must return one of the following: TreeItem, TreeItem[], ResultSet
   */
  resolveDoubleClick(connectionName, datasets, onDone) {
    let command = undefined;

    if (datasets.database && datasets.database.length > 0) {
      command = (connection)=>database.getTopics(connection, datasets.database, onDone, this.logger);
    } else if (datasets.host && datasets.user) {
      command = (connection)=>database.getSchemas(connection, onDone, this.logger);
    } else if (datasets.tables) {
      command = (connection)=>table.getTables(connection, datasets.tables, onDone, this.logger);
    } else if (datasets.table) {
      command = (connection)=>table.getContent(connection, datasets.table, onDone, this.logger);
    } else if (datasets.views) {
      command = (connection)=>view.getViews(connection, datasets.views, onDone, this.logger);
    } else if (datasets.view) {
      command = (connection)=>view.getContent(connection, datasets.view, onDone, this.logger);
    } else if (datasets.functions) {
      command = (connection)=>func.getAll(connection, datasets.functions, onDone, this.logger);
    } else if (datasets.procedures) {
      command = (connection)=>proc.getAll(connection, datasets.procedures, onDone, this.logger);
    } else if (datasets.routine) {
      let routine = datasets.routineType === func.type ? func : proc;
      command = (connection)=>routine.getContent(connection, datasets.routine, datasets.schema, onDone, this.logger);
    } else if (datasets.events) {
      command = (connection)=>generalEvents.getAll(connection, datasets.events, onDone, this.logger);
    } else if (datasets.event) {
      command = (connection)=>generalEvents.getContent(connection, datasets.event, onDone, this.logger);
    }  else if (datasets.trigger) {
      command = (connection)=>trigger.getContent(connection, datasets.trigger, datasets.triggerSchema, datasets.triggerTable, onDone, this.logger);
    }

    let poolCreation = ()=>{
      this._connect(datasets).then((pool)=>{
        pool.getConnection().then(connection=>{
          this.pools[connectionName] = pool;
          command(connection);
          connection.release();
        }).catch(err=>{
          onDone(err || "Failed to connect");
          return;
        });
      });
    };

    if (command) {
      this._executeOnConnection(
        connectionName,
        (connection)=>{
          command(connection);
          connection.release();
        },
        (error)=>{
          if (error === POOL_NOT_EXIST) {
            poolCreation();
          } else {
            onDone(error);
          }
        }
      );
    } else {
      onDone();
    }
  }

  _executeOnConnection(connectionName, onSuccess, onError) {
    let pool = this.pools[connectionName] || undefined;

    if (pool) {
      pool.getConnection().then(connection=>{
        onSuccess(connection);
      }).catch(err=>{
        onError(err || "Failed to connect");
        return;
      });
    } else {
      onError(POOL_NOT_EXIST);
    }
  }

  /**
   * triggered every time that an action on node is clicked
   * @param  {string}   action          The name given to the action (set on ItemAction)
   * @param  {string}   connectionName  Reference for the user's connection
   * @param  {object}   datasets        Node datasets to support the action
   * @param  {callable} onDone          A callable used when the processing is done. onDone must return one of the following: TreeItem, TreeItem[], ResultSet
   */
  resolveActionClick(action, connectionName, datasets, onDone) {
    let command = ()=>onDone('Action not implemented');

    if (action === 'structure') {
      if (datasets.table || datasets.view) {
        let domain = datasets.table ? table : view;
        let structure = datasets.table ? datasets.table : datasets.view;

        command = (connection)=>domain.getDataStructure(structure, connection, onDone, this.logger);
      } else if (datasets.event) {
        command = (connection)=>generalEvents.getStructure(datasets.name, connection, onDone, this.logger);
      } else if (datasets.trigger) {
        command = (connection)=>trigger.getStructure(datasets.name, connection, onDone, this.logger);
      } else if (datasets.routine) {
        let routine = datasets.routineType === func.type ? func : proc;
        command = (connection)=>routine.getStructure(datasets.name, connection, onDone, this.logger);
      }
    }

    this._executeOnConnection(
      connectionName,
      (connection)=>{
        command(connection);
        connection.release();
      },
      onDone
    );
  }

  /**
   * @param {string}   uuid            Can be an empty string (when the user executes a query directly from the editor)
   * @param {string}   query           the query requested by the user
   * @param {string}   connectionName  Reference for the user's connection
   * @param {object}   datasets        Node datasets to support the action
   * @param {callable} onDone          A callable used when the processing is done. onDone must return one of the following: TreeItem, TreeItem[], ResultSet
   */
  executeQuery(uuid, query, connectionName, datasets, onDone) {
    this.logger.log(query);

    this.running[uuid] =  query;

    let command = (connection)=>{
      connection.query(query).then((results) => {
        if (results.constructor.name === 'OkPacket') {
          atom.notifications.addSuccess(
            this.getName() + "- Success!",
            {
              buttons: [],
              detail: "Query successfully executed",
              dismissable: false
            }
          );

          onDone(
              new ResultSet({
              recordsAffected: results.affectedRows
            })
          );
          return
        } else {
          if (Array.isArray(results[0])) {
            results = results[0];
          }

          let fieldNames = Object.keys(results[0]);
          let fields = results.meta.map((f, i)=>Object.assign(f, {title: fieldNames[i]}));

          let resultSet = new ResultSet({
            columns: fields.map((f)=>{
              return {
                name: f.title,
                type: fieldType(f.columnType)
              };
            }),
            data: results.map((r)=>Object.values(r)),
            grammar: 'source.sql',
          });

          onDone(resultSet);
        }
      }).catch(err=>{
        if (err) {
          atom.notifications.addError(
            this.getName() + " - Failed to run query!",
            {
              buttons: [],
              detail: err,
              dismissable: true
            }
          );

          onDone();
          return;
        }
      });
    };

    let poolCreation = ()=>{
      this._connect(datasets).then((pool)=>{
        pool.getConnection().then(connection=>{
          this.pools[connectionName] = pool;
          command(connection);
          connection.release();
        }).catch(err=>{
          onDone(err || "Failed to connect");
          return;
        });
      });
    };

    this._executeOnConnection(
      connectionName,
      (connection)=>{
        command(connection);
        connection.release();
      },
      (error)=>{
        if (error === POOL_NOT_EXIST && datasets.engine) {
          poolCreation();
        } else {
          onDone(error);
        }
      }
    )
  }

  /**
   * refresh node is a right-click option for every node. It is up to your implementation to decide if it will return something or not.
   * @param  {string}   connectionName  Reference for the user's connection
   * @param  {object}   datasets        Node datasets to support the refresh
   * @param  {callable} onDone          The onDone callback will just be processed if a TreeItem element is returned
   */
  refreshNode(connectionName, datasets, onDone) {
    let command = (connection)=>onDone('refresh not implemented');

    if (datasets.table) {
      command = (connection)=>table.getTables(
        connection,
        datasets.singleSchema,
        (tables)=>{
          onDone(tables.length > 0 ? tables[0] : undefined);
        },
        this.logger,
        datasets.singleName,
      );
    } else if (datasets.tables) {
      command = (connection)=>table.getTables(
        connection,
        datasets.tables,
        (tables)=>onDone(table.getTablesNode(datasets.tables, tables)),
        this.logger,
      );
    } else if (datasets.view) {
      command = (connection)=>view.getViews(
        connection,
        datasets.singleSchema,
        (views)=>{
          onDone(views.length > 0 ? views[0] : undefined);
        },
        this.logger,
        datasets.singleName,
      );
    } else if (datasets.views) {
      command = (connection)=>view.getViews(
        connection,
        datasets.views,
        (views)=>onDone(view.getViewsNode(datasets.views, views)),
        this.logger,
      );
    } else if (datasets.routine) {
      let routine = datasets.routineType === func.type ? func : proc;
      command = (connection)=>routine.getAll(
        connection,
        datasets.schema,
        (routines)=>{
          onDone(routines.length > 0 ? routines[0] : undefined);
        },
        this.logger,
        datasets.routine
      );
    } else if (datasets.procedures) {
      command = (connection)=>proc.getAll(
        connection,
        datasets.procedures,
        (procs)=>onDone(proc.getProceduresNode(datasets.procedures, procs)),
        this.logger,
      );
    } else if (datasets.functions) {
      command = (connection)=>func.getAll(
        connection,
        datasets.functions,
        (funcs)=>onDone(func.getFunctionsNode(datasets.functions, funcs)),
        this.logger,
      );
    } else if (datasets.events) {
      command = (connection)=>generalEvents.getAll(
        connection,
        datasets.events,
        (events)=>onDone(generalEvents.getEventsNode(datasets.events, events)),
        this.logger,
      );
    }

    this._executeOnConnection(
      connectionName,
      (connection)=>{
        command(connection);
        connection.release();
      },
      (error)=>onDone(error)
    );
  }

  /**
   * If your database supports to stop ongoing queries, this method can be used to do it.
   * @param {string} uuid     a reference to the query's uuid send executeQuery method
   * @param {object} connData connection fields to support the action
   */
  stopQuery(uuid, connData) {
    let queryToStop = this.running[uuid];
    let query = `
  SELECT *
  FROM information_schema.processlist
  WHERE info = '${queryToStop}'
   AND user = '${connData.user}'
  `;

    let getProcess = (connection)=>{
      connection.query(query).then((results) => {
        if (results.length > 0) {
          let killId = results[0].ID;
          let queryKill = `KILL ${killId}`;

          connection.query(queryKill).then(results => {
            atom.notifications.addInfo('Query killed', {detail: queryToStop});
          }).catch(err=>{
            console.log('Error on killing process');
          });
        }
      }).catch(err=>{
        console.log('error', err);
      });
    };

    this._connect(connData).then((pool)=>{
      pool.getConnection().then(connection=>{
        getProcess(connection);
        connection.release();
      }).catch(err=>{
        console.log(err || "Failed to connect");
        return;
      });
    });
  }

}
