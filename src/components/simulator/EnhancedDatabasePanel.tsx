// 增强的数据库面板 - 阶段四功能
import { useState, useMemo } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Play, 
  Trash2, 
  Table as TableIcon,
  Database,
  Key,
  RefreshCw,
  Download
} from 'lucide-react';

interface NewColumn {
  name: string;
  type: string;
  primaryKey: boolean;
}

export function EnhancedDatabasePanel() {
  const { database, updateDatabase } = useSimulatorStore();
  const [selectedTable, setSelectedTable] = useState(database.tables[0]?.name || '');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM sensorlog ORDER BY id DESC LIMIT 10');
  const [queryResult, setQueryResult] = useState<string>('');
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newColumn, setNewColumn] = useState<NewColumn>({ name: '', type: 'TEXT', primaryKey: false });

  const currentTable = database.tables.find((t) => t.name === selectedTable);
  const tableData = useMemo(() => database.records[selectedTable] || [], [database.records, selectedTable]);

  // 执行SQL查询
  const handleRunQuery = () => {
    try {
      const query = sqlQuery.toLowerCase().trim();
      
      if (query.startsWith('select')) {
        // 解析简单的SELECT语句
        const fromMatch = query.match(/from\s+(\w+)/i);
        const tableName = fromMatch ? fromMatch[1] : selectedTable;
        const records = database.records[tableName] || [];
        
        // 处理LIMIT
        const limitMatch = query.match(/limit\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1]) : records.length;
        
        // 处理ORDER BY DESC
        let result = [...records];
        if (query.includes('order by') && query.includes('desc')) {
          result = result.reverse();
        }
        
        result = result.slice(0, limit);
        setQueryResult(JSON.stringify(result, null, 2));
      } else if (query.startsWith('insert')) {
        setQueryResult('INSERT 操作需要通过模拟运行来执行');
      } else if (query.startsWith('delete')) {
        // 支持简单的DELETE
        const fromMatch = query.match(/from\s+(\w+)/i);
        const tableName = fromMatch ? fromMatch[1] : selectedTable;
        
        if (query.includes('where')) {
          setQueryResult('DELETE with WHERE 暂不支持，请直接操作表格');
        } else {
          updateDatabase({
            ...database,
            records: {
              ...database.records,
              [tableName]: [],
            },
          });
          setQueryResult(`已清空表 ${tableName}`);
        }
      } else {
        setQueryResult('仅支持 SELECT, INSERT, DELETE 语句');
      }
    } catch (error) {
      setQueryResult(`查询错误: ${error}`);
    }
  };

  // 添加新记录
  const handleAddRecord = () => {
    if (!currentTable) return;
    
    const newRecord: Record<string, unknown> = {};
    currentTable.columns.forEach((col) => {
      if (col.primaryKey) {
        newRecord[col.name] = (tableData.length || 0) + 1;
      } else if (col.type === 'INTEGER') {
        newRecord[col.name] = 0;
      } else if (col.type === 'REAL') {
        newRecord[col.name] = 0.0;
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

  // 删除记录
  const handleDeleteRecord = (index: number) => {
    const newRecords = tableData.filter((_, i) => i !== index);
    updateDatabase({
      ...database,
      records: {
        ...database.records,
        [selectedTable]: newRecords,
      },
    });
  };

  // 添加新表
  const handleAddTable = () => {
    if (!newTableName.trim()) return;
    
    const newTable = {
      name: newTableName,
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
      ],
    };
    
    updateDatabase({
      tables: [...database.tables, newTable],
      records: {
        ...database.records,
        [newTableName]: [],
      },
    });
    
    setSelectedTable(newTableName);
    setNewTableName('');
    setIsAddTableOpen(false);
  };

  // 添加列
  const handleAddColumn = () => {
    if (!newColumn.name.trim() || !currentTable) return;
    
    const updatedTable = {
      ...currentTable,
      columns: [...currentTable.columns, { 
        name: newColumn.name, 
        type: newColumn.type, 
        primaryKey: newColumn.primaryKey 
      }],
    };
    
    updateDatabase({
      tables: database.tables.map(t => t.name === selectedTable ? updatedTable : t),
      records: {
        ...database.records,
        [selectedTable]: tableData.map(record => {
          const typedRecord = record as Record<string, unknown>;
          return {
            ...typedRecord,
            [newColumn.name]: newColumn.type === 'INTEGER' || newColumn.type === 'REAL' ? 0 : '',
          };
        }),
      },
    });
    
    setNewColumn({ name: '', type: 'TEXT', primaryKey: false });
    setIsAddColumnOpen(false);
  };

  // 导出数据
  const handleExport = () => {
    const data = JSON.stringify({
      table: selectedTable,
      columns: currentTable?.columns,
      records: tableData,
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 清空表数据
  const handleClearTable = () => {
    updateDatabase({
      ...database,
      records: {
        ...database.records,
        [selectedTable]: [],
      },
    });
  };

  return (
    <div className="h-full flex">
      {/* 左侧：表列表 */}
      <div className="w-44 border-r border-border flex flex-col">
        <div className="flex items-center justify-between p-2 border-b border-border">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <Database className="h-3 w-3" />
            数据表
          </h4>
          <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-5 w-5">
                <Plus className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新表</DialogTitle>
                <DialogDescription>输入新表的名称</DialogDescription>
              </DialogHeader>
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="表名..."
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <Button onClick={handleAddTable}>创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {database.tables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1 ${
                  selectedTable === table.name
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <TableIcon className="h-3 w-3" />
                {table.name}
                <Badge variant="secondary" className="ml-auto text-[9px] px-1">
                  {database.records[table.name]?.length || 0}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
        
        {/* 表结构 */}
        {currentTable && (
          <div className="border-t border-border p-2">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-[10px] font-medium text-muted-foreground">表结构</h5>
              <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-4 w-4">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加列</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>列名</Label>
                      <Input
                        value={newColumn.name}
                        onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                        placeholder="列名..."
                      />
                    </div>
                    <div>
                      <Label>类型</Label>
                      <Select
                        value={newColumn.type}
                        onValueChange={(v) => setNewColumn({ ...newColumn, type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INTEGER">INTEGER</SelectItem>
                          <SelectItem value="REAL">REAL</SelectItem>
                          <SelectItem value="TEXT">TEXT</SelectItem>
                          <SelectItem value="DATETIME">DATETIME</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">取消</Button>
                    </DialogClose>
                    <Button onClick={handleAddColumn}>添加</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-0.5 text-[10px]">
              {currentTable.columns.map((col) => (
                <div
                  key={col.name}
                  className="flex items-center gap-1 text-muted-foreground py-0.5"
                >
                  {col.primaryKey ? (
                    <Key className="h-2.5 w-2.5 text-yellow-500" />
                  ) : (
                    <span className="w-2.5 h-2.5 flex items-center justify-center">•</span>
                  )}
                  <span className="flex-1">{col.name}</span>
                  <span className="opacity-50">{col.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右侧：数据视图 */}
      <div className="flex-1 flex flex-col">
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-2 border-b border-border">
          <h4 className="text-xs font-medium">{selectedTable}</h4>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={handleAddRecord}>
              <Plus className="h-3 w-3 mr-1" />
              添加
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={handleClearTable}>
              <RefreshCw className="h-3 w-3 mr-1" />
              清空
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={handleExport}>
              <Download className="h-3 w-3 mr-1" />
              导出
            </Button>
          </div>
        </div>
        
        {/* 数据表格 */}
        <ScrollArea className="flex-1">
          {currentTable && (
            <Table>
              <TableHeader>
                <TableRow>
                  {currentTable.columns.map((col) => (
                    <TableHead key={col.name} className="text-[10px] py-1 px-2">
                      <div className="flex items-center gap-1">
                        {col.primaryKey && <Key className="h-2.5 w-2.5 text-yellow-500" />}
                        {col.name}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={currentTable.columns.length + 1}
                      className="text-center text-muted-foreground text-xs py-8"
                    >
                      暂无数据 - 点击&quot;添加&quot;或运行仿真
                    </TableCell>
                  </TableRow>
                ) : (
                  tableData.map((row, index) => (
                    <TableRow key={index}>
                      {currentTable.columns.map((col) => (
                        <TableCell key={col.name} className="text-[10px] py-1 px-2 font-mono">
                          {formatCellValue((row as Record<string, unknown>)[col.name], col.type)}
                        </TableCell>
                      ))}
                      <TableCell className="py-1 px-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleDeleteRecord(index)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* SQL 查询 */}
        <div className="border-t border-border p-2 space-y-2">
          <div className="flex gap-2">
            <Input
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="输入 SQL 查询..."
              className="flex-1 font-mono text-[10px] h-7"
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleRunQuery}>
              <Play className="h-3 w-3 mr-1" />
              执行
            </Button>
          </div>
          {queryResult && (
            <pre className="p-2 bg-muted rounded text-[10px] overflow-auto max-h-16 font-mono">
              {queryResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '-';
  
  if (type === 'DATETIME' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleString('zh-CN', { 
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return String(value);
    }
  }
  
  if (type === 'REAL' && typeof value === 'number') {
    return value.toFixed(2);
  }
  
  return String(value);
}
