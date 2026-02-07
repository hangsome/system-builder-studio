import { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Download, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import {
  fetchLicenses,
  generateLicenses,
  revokeLicense,
  getAdminToken,
  setAdminToken,
  AdminLicense,
} from '@/lib/adminApi';

const DEFAULT_LIMIT = 50;

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function exportCsv(licenses: AdminLicense[]) {
  const headers = ['license_key', 'license_type', 'status', 'device_count', 'created_at', 'activated_at', 'notes'];
  const rows = licenses.map((license) => [
    license.license_key,
    license.license_type,
    license.status,
    String(license.device_count ?? 0),
    license.created_at || '',
    license.activated_at || '',
    license.notes || '',
  ]);
  
  const escapeCell = (value: string) => {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  
  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `licenses_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const [tokenInput, setTokenInput] = useState(getAdminToken() || '');
  const [tokenSaved, setTokenSaved] = useState(!!getAdminToken());
  
  const [licenses, setLicenses] = useState<AdminLicense[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [generateType, setGenerateType] = useState<'personal' | 'teacher'>('personal');
  const [generateCount, setGenerateCount] = useState(10);
  const [generateNotes, setGenerateNotes] = useState('');
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  
  const filters = useMemo(() => ({
    status: statusFilter,
    type: typeFilter,
    limit,
    offset: 0,
  }), [statusFilter, typeFilter, limit]);
  
  const loadLicenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchLicenses(filters);
      setLicenses(response.licenses);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);
  
  useEffect(() => {
    if (tokenSaved) {
      loadLicenses();
    }
  }, [tokenSaved, loadLicenses]);
  
  const handleSaveToken = () => {
    setAdminToken(tokenInput.trim());
    setTokenSaved(!!tokenInput.trim());
    setSuccess('管理员 Token 已保存');
    setError(null);
  };
  
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await generateLicenses({
        count: generateCount,
        type: generateType,
        notes: generateNotes.trim(),
      });
      setGeneratedKeys(response.licenses);
      setSuccess(`已生成 ${response.count} 个序列号`);
      loadLicenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRevoke = async (licenseKey: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await revokeLicense(licenseKey);
      setSuccess('序列号已撤销');
      loadLicenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : '撤销失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              管理员后台
            </h1>
            <p className="text-sm text-muted-foreground">
              生成、管理、撤销序列号，支持导出 CSV
            </p>
          </div>
          <Button variant="outline" onClick={loadLicenses} disabled={loading || !tokenSaved}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-primary/20 bg-primary/5 text-primary">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>管理员 Token</CardTitle>
            <CardDescription>输入后将保存在浏览器 sessionStorage 中</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-token">Bearer Token</Label>
              <Input
                id="admin-token"
                placeholder="请输入管理员 Token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveToken}>保存 Token</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>生成序列号</CardTitle>
            <CardDescription>支持批量生成 personal / teacher 序列号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>数量</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={generateType} onValueChange={(value) => setGenerateType(value as 'personal' | 'teacher')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">个人版</SelectItem>
                    <SelectItem value="teacher">教师版</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>备注</Label>
                <Input
                  placeholder="可选，用于批量备注"
                  value={generateNotes}
                  onChange={(e) => setGenerateNotes(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading || !tokenSaved}>
              生成序列号
            </Button>
            
            {generatedKeys.length > 0 && (
              <div className="space-y-2">
                <Label>生成结果（可直接复制）</Label>
                <Textarea value={generatedKeys.join('\n')} readOnly className="h-40 font-mono" />
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>序列号列表</CardTitle>
            <CardDescription>当前筛选结果：{total} 条</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部</SelectItem>
                    <SelectItem value="unused">未使用</SelectItem>
                    <SelectItem value="activated">已激活</SelectItem>
                    <SelectItem value="revoked">已撤销</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部</SelectItem>
                    <SelectItem value="personal">个人版</SelectItem>
                    <SelectItem value="teacher">教师版</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>每页数量</Label>
                <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="50" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end">
                <Button variant="outline" onClick={() => exportCsv(licenses)} disabled={!licenses.length}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </Button>
              </div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>序列号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>设备数</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>激活时间</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        {tokenSaved ? '暂无数据' : '请先保存管理员 Token'}
                      </TableCell>
                    </TableRow>
                  )}
                  {licenses.map((license) => (
                    <TableRow key={license.license_key}>
                      <TableCell className="font-mono">{license.license_key}</TableCell>
                      <TableCell>{license.license_type === 'personal' ? '个人版' : '教师版'}</TableCell>
                      <TableCell>
                        <Badge variant={license.status === 'activated' ? 'default' : license.status === 'revoked' ? 'destructive' : 'secondary'}>
                          {license.status === 'unused' && '未使用'}
                          {license.status === 'activated' && '已激活'}
                          {license.status === 'revoked' && '已撤销'}
                        </Badge>
                      </TableCell>
                      <TableCell>{license.device_count ?? 0}</TableCell>
                      <TableCell>{formatDate(license.created_at)}</TableCell>
                      <TableCell>{formatDate(license.activated_at)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={license.notes || ''}>{license.notes || '-'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevoke(license.license_key)}
                          disabled={license.status === 'revoked' || loading}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          撤销
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
