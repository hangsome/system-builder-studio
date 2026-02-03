import { useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Play, Trash2 } from 'lucide-react';

export function DatabasePanel() {
  const { database, updateDatabase } = useSimulatorStore();
  const [selectedTable, setSelectedTable] = useState(database.tables[0]?.name || '');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM sensorlog ORDER BY id DESC LIMIT 10');
  const [queryResult, setQueryResult] = useState<string>('');

  const currentTable = database.tables.find((t) => t.name === selectedTable);
  const tableData = database.records[selectedTable] || [];

  const handleRunQuery = () => {
    // 简单的 SQL 查询模拟
    try {
      if (sqlQuery.toLowerCase().includes('select')) {
        const tableName = selectedTable;
        const records = database.records[tableName] || [];
        setQueryResult(JSON.stringify(records, null, 2));
      } else {
        setQueryResult('仅支持 SELECT 查询');
      }
    } catch (error) {
      setQueryResult('查询错误');
    }
  };

  const handleAddRecord = () => {
    if (!currentTable) return;
    
    const newRecord: Record<string, unknown> = {};
    currentTable.columns.forEach((col) => {
      if (col.primaryKey) {
        newRecord[col.name] = (tableData.length || 0) + 1;
      } else if (col.type === 'INTEGER' || col.type === 'REAL') {
        newRecord[col.name] = 0;
      } else if (col.type === 'DATETIME') {
        newRecord[col.name] = new Date().toISOString();
      } else {
        newRecord[col.name] = '';
      }
    });

    updateDatabase({
      ...database,
      records: {
        ...database.records,
        [selectedTable]: [...tableData, newRecord],
      },
    });
  };

  return (
    <div className="h-full flex">
      {/* 表列表 */}
      <div className="w-48 border-r border-border p-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">数据表</h4>
          <Button size="icon" variant="ghost" className="h-6 w-6">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-1">
          {database.tables.map((table) => (
            <button
              key={table.name}
              onClick={() => setSelectedTable(table.name)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                selectedTable === table.name
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              📋 {table.name}
            </button>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">
            表结构
          </h5>
          {currentTable && (
            <div className="space-y-1 text-xs">
              {currentTable.columns.map((col) => (
                <div
                  key={col.name}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <span className={col.primaryKey ? 'text-yellow-500' : ''}>
                    {col.primaryKey ? '🔑' : '•'}
                  </span>
                  <span>{col.name}</span>
                  <span className="text-[10px] opacity-50">{col.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 数据视图 */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto p-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">{selectedTable} 数据</h4>
            <Button size="sm" variant="outline" onClick={handleAddRecord}>
              <Plus className="h-4 w-4 mr-1" />
              添加记录
            </Button>
          </div>
          
          {currentTable && (
            <Table>
              <TableHeader>
                <TableRow>
                  {currentTable.columns.map((col) => (
                    <TableHead key={col.name} className="text-xs">
                      {col.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row, index) => (
                  <TableRow key={index}>
                    {currentTable.columns.map((col) => (
                      <TableCell key={col.name} className="text-xs py-1">
                        {String((row as Record<string, unknown>)[col.name] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {tableData.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={currentTable.columns.length}
                      className="text-center text-muted-foreground text-sm py-4"
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* SQL 查询 */}
        <div className="border-t border-border p-2">
          <div className="flex gap-2">
            <Input
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="输入 SQL 查询..."
              className="flex-1 font-mono text-xs"
            />
            <Button size="sm" onClick={handleRunQuery}>
              <Play className="h-4 w-4 mr-1" />
              执行
            </Button>
          </div>
          {queryResult && (
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-20">
              {queryResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
