'use babel';

import ConnectionSettings from './dataModel/connection-settings';
import TreeItem from './dataModel/tree-item';
import ItemAction from './dataModel/item-action';
import FieldConnection from './dataModel/field-connection';
import {default as ResultSet, TYPE} from './dataModel/result-set';

/**
 * Sample Engine exemplifies the essential methods that a custom dbex engine
 * must have and how to interact and respond to the requests.
 */
export default class SampleEngine {
  /**
   * @param {Logger} logger Logger instance from dbex.
   */
  constructor(logger) {
    this.logger = logger;
    this.connections = {};  // Engines are responsible for the connections made therefore multiple connections also
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
    return "sample-dbex-generic-engine"; //  Be creative to not get conflicted by other author's names
  }

  /**
   * Engine icon getter.
   * Must be a css class that represents an icon for the connections created with this engine.
   * Take a look on the styles/style.less for more details.
   *
   * @return {string}
   */
  getIconClass() {
    return "sample-engine-icon";
  }

  /**
   * Connection settings are used to specify the fields needed to make the connection.
   * All the fields in this list will come later on future requests.
   * @return {ConnectionSettings}
   */
  getConnectionSettings() {
    return new ConnectionSettings({
      name: this.getName(),
      label: "Sample Engine", // this name is show on the dbex list of engines
      custom: [
        new FieldConnection({id: 'host', title: "Host", tip:"Use localhost for this sample to work"}),
        new FieldConnection({id: 'port', title: "Port", tip:"Only numbers"}),
        new FieldConnection({id: 'user', title: "User"}),
        new FieldConnection({id: 'password', title: "Password"}),
        new FieldConnection({id: 'database', title: "Database", tip: "Optional"}),
        new FieldConnection({id: 'ssl', title: "Use SSL", tip: "Default is to not use", isBool:true}),
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
      this._sampleConnect(ccf).then(
        (resultMessage)=>onConnect(resultMessage),
        (resultMessage)=>onFail(resultMessage)
      );
    } else {
      onFail("Some necessary fields are not filled. Please check again");
    }
  }

  /**
   * Do your own connection implementation. This is just a sample ;)
   */
  _sampleConnect(connectionFields) {
    return new Promise((resolve, reject) => {
      if (connectionFields.host === 'localhost') {
        resolve("Success - Sample");
      } else {
        reject("Failed to connect - Sample");
      }
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
    let result;

    // if exists custom fields given by getConnectionSettings, then it is the main node, therefore we can bring the root structure
    if (datasets.host && datasets.user) {
      result = this._getFirstLevelItems();
    }
    // if the custom database attribute exists in datasets, in our case, means that the user requested a 2nd level tree (becase database is our custom attribute to identify that)
    else if (datasets.database) {
      result = this._getSecondLevelItems(datasets.database);
    }
    // if the custom tableName attribute exists in datasets, in our case, means that the user requested a 3nd level tree
    else if (datasets.tableName) {
      result = this._getSomeDataOnTable(datasets.tableName);
    }

    onDone(result); // call the onDone with our result
  }

  /**
   * This is the representation of your database response. Could be different for each database/driver/command used
   * @return {object[]} some sample data for the first level tree.
   */
  _getFirstLevelItems() {
    let databases = [
      {
        label: 'Tamen Fugiat',
        name: 'tamen-fugiat-quis',
        tables: 2,
      },
      {
        label: 'Aliqua Noster',
        name: 'aliqua-noster-erum',
        tables: 1,
      }
    ];

    let result = [];

    databases.forEach((record)=>{
      result.push(
        new TreeItem({
          label: record.label,    // the label that will be show to the user on the tree view
          name: record.name,      // a unique referral name for this node
          icon: 'icon-database',  // an icon for this node. Can be any already implemented on dbex or your own icon implementation
          details: record.tables, // a string that will be placed on the right side of the label
          collapsed: false,       // identifies if the result should be show collapsed or not
          datasets: {             // all the data in this block is custom and will be returned to the engine when node is double clicked. Use as many fields as needed to identify this node and take future actions
            database: record.name,
          },
          classes: ['sample-table-counter-detail'], // optional custom style classes to be added to the node
          actions: []             // optional item-action objects to the node
        })
      );
    });

    return result;
  }

  /**
   * This is the representation of your database response. Could be different for each database/driver/command used
   * @param  {string}   databaseName  the database name to retrieve sample tables
   * @return {object[]} some sample data for the second level tree.
   */
  _getSecondLevelItems(databaseName) {
    let tables = {
      'tamen-fugiat-quis': [
        {
          label: 'Table 01',
          name: 'table-01',
        },
        {
          label: 'Table 02',
          name: 'table-02',
        }
      ],
      'aliqua-noster-erum': [
        {
          label: 'Dummy Table',
          name: 'dummy-table',
        },
      ]
    };

    let result = [];

    tables[databaseName].forEach((table)=>{
      result.push(
        new TreeItem({
          label: table.label,     // the label that will be show to the user on the tree view
          name: table.name,       // a unique referral name for this node
          icon: 'icon-table',     // an icon for this node. Can be any already implemented on dbex or your own icon implementation
          collapsed: true,        // identifies if the result should be show collapsed or not
          datasets: {             // all the data in this block is custom and will be returned to the engine when node is double clicked. Use as many fields as needed to identify this node and take future actions
            tableName: table.name,
          },
          actions: [              // optional item-action objects to the node
            new ItemAction({name:"structure", icon:"icon-struct", description:"Show sample structure"}),
          ],
          children: this._getChildren(table.name),    // node children can be added also ase needed
        })
      );
    });

    return result;
  }

  _getChildren(tableName) {
    let children = {
      'table-01': [
        {
          label: 'Id',
          name: 'id',
          isPrimaryKey: true,
          type: 'int',
        },
        {
          label: 'Name',
          name: 'name',
          isPrimaryKey: false,
          type: 'varchar(8)',
        }
      ],
      'table-02': [],
      'dummy-table': [],
    };

    let result = [];

    children[tableName].forEach((field)=>{
      result.push(
        new TreeItem({
          label: field.label,                                   // the label that will be show to the user on the tree view
          name: tableName + '-' + field.name,                   // a unique referral name for this node
          icon: field.isPrimaryKey ? 'icon-pk' : 'icon-field',  // an icon for this node. Can be any already implemented on dbex or your own icon implementation
          details: field.type,                                  // a string that will be placed on the right side of the label
          collapsed: false,       // identifies if the result should be show collapsed or not
          datasets: {             // all the data in this block is custom and will be returned to the engine when node is double clicked. Use as many fields as needed to identify this node and take future actions
            table: tableName,
            field: field.name
          }
        })
      );
    });

    return result;
  }

  /**
   * triggered every time that an action on node is clicked
   * @param  {string}   action          The name given to the action (set on ItemAction)
   * @param  {string}   connectionName  Reference for the user's connection
   * @param  {object}   datasets        Node datasets to support the action
   * @param  {callable} onDone          A callable used when the processing is done. onDone must return one of the following: TreeItem, TreeItem[], ResultSet
   */
  resolveActionClick(action, connectionName, datasets, onDone) {
    if (action === 'structure') {
      onDone(this._getStructure(datasets.tableName));
    }
  }

  /**
   * This is the representation of your database response. Could be different for each database/driver/command used
   * @param  {string}   tableName A table name to retrieve sample structure
   * @return {ResultSet} some sample structure.
   */
  _getStructure(tableName) {
    let tableStructures = {
      'table-01':`
CREATE TABLE Table01 (
  "id" primary key int,
  "name" char(08)
  ... etc sample data
      `,

      'table-02':`
CREATE TABLE Table02 (
  "id" primary key int,
  "hash" char(32)
  ... etc sample data
      `,

      'dummy-table': `
CREATE TABLE Table01 (
  "id" primary key int,
  "something" char(255)
  ... dummy
      `,
    }

    return new ResultSet( // This is the object that tells dbex what to show on the result area (data-table, query, records affected, etc)
      {
        query: tableStructures[tableName]   // in this case we are using the query attribute to return an example of a query structure
      }
    );
  }

  /**
   * This is the representation of your database response. Could be different for each database/driver/command used
   * @param  {string}   tableName A table name to retrieve sample data
   * @return {ResultSet} some sample data.
   */
  _getSomeDataOnTable(tableName) {
    let tablesData = {
      'table-01': {
        columns: [
          {name: 'id', type: TYPE.number},
          {name: 'name', type: TYPE.text},
          {name: 'created', type: TYPE.date}
        ],
        values: [
          [1, "aliqua aliqua", "2012-03-21"],
          [2, "duis quid", "2018-11-13"],
          [3, "multos cillum", "2020-08-13"],
          [4, "culpa sint", "1980-07-06"],
        ],
      },
      'table-02': {
        columns: [
          {name: 'id', type: TYPE.number},
          {name: 'hash', type: TYPE.text},
          {name: 'deleted', type: TYPE.boolean}
        ],
        values: [
          [144, "befc6ec9-4818-460d-a549-ac2b11089480", true],
          [223, "618b57e3-4760-4126-a304-9ba01e3feb38", false],
          [245, "84a94c0b-3ae2-406f-b2af-0f2b4a3556ba", null],
        ],
      },
      'dummy-table': {
        columns: [
          {name: 'id', type: TYPE.number},
          {name: 'something', type: TYPE.undefined},
        ],
        values: []
      }
    }

    return new ResultSet({
      columns: tablesData[tableName].columns,
      data: tablesData[tableName].values,
      query: `SELECT * FROM ${tableName}`     // the query attribute is optional, but here it is just to exemplify that you can return data + query together
    });
  }

  /**
   * @param {string}   uuid            Can be an empty string (when the user executes a query directly from the editor)
   * @param {string}   query           the query requested by the user
   * @param {string}   connectionName  Reference for the user's connection
   * @param {object}   datasets        Node datasets to support the action
   * @param {callable} onDone          A callable used when the processing is done. onDone must return one of the following: TreeItem, TreeItem[], ResultSet
   */
  executeQuery(uuid, query, connectionName, datasets, onDone) {
    // from this method, the ResultSet can have any response as the other methods. It can be data/columns, query or just the rows affected.
    onDone(
      new ResultSet({
        recordsAffected: Math.floor((Math.random() * 100) + 1)  // simulate some record affected
      })
    );
  }

  /**
   * If your database supports to stop ongoing queries, this method can be used to do it.
   * @param {string} uuid     a reference to the query's uuid send executeQuery method
   * @param {object} connData connection fields to support the action
   */
  stopQuery(uuid, connData) {
    // ... your code to cancel the query goes here
  }

  /**
   * refresh node is a right-click option for every node. It is up to your implementation to decide if it will return something or not.
   * @param  {string}   connectionName  Reference for the user's connection
   * @param  {object}   datasets        Node datasets to support the refresh
   * @param  {callable} onDone          The onDone callback will just be processed if a TreeItem element is returned
   */
  refreshNode(connectionName, datasets, onDone) {
    if (datasets.tableName) {
      // exemplifying the TreeItem object to be returned
      let node = new TreeItem({
        label: datasets.label,
        name: datasets.tableName,
        icon: 'icon-table',
        collapsed: true,
        details: 'updated ' + Date.now(),
        datasets: {
          tableName: datasets.tableName,
        },
        actions: [
          new ItemAction({name:"structure", icon:"icon-struct", description:"Show sample structure"}),
        ],
        children: this._getChildren(datasets.tableName),
      });

      onDone(node);
    }
  }
}
