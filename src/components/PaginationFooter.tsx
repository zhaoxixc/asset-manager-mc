import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Button,
} from '@mui/material';
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

interface PaginationFooterProps {
  /** 总条数 */
  count: number;
  /** 当前页（0开始） */
  page: number;
  rowsPerPage: number;
  rowsPerPageOptions?: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  /** 页码跳转超出范围时的提示回调（不传则静默忽略） */
  onJumpError?: (message: string) => void;
}

/** 通用分页底栏：每页条数 + 统计 + 翻页按钮 + 页码跳转 */
const PaginationFooter: React.FC<PaginationFooterProps> = ({
  count,
  page,
  rowsPerPage,
  rowsPerPageOptions = [10, 20, 50, 100],
  onPageChange,
  onRowsPerPageChange,
  onJumpError,
}) => {
  const [jump, setJump] = useState<string>('');
  const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const from = count === 0 ? 0 : safePage * rowsPerPage + 1;
  const to = Math.min((safePage + 1) * rowsPerPage, count);

  // 数据变化后清空遗留的跳转输入
  useEffect(() => { setJump(''); }, [count, rowsPerPage]);

  const handleJump = () => {
    const target = parseInt(jump, 10);
    if (isNaN(target) || target < 1 || target > totalPages) {
      onJumpError?.(`请输入 1 - ${totalPages} 之间的页码`);
      return;
    }
    onPageChange(target - 1);
    setJump('');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 2, py: 1, borderTop: '1px solid #e8eaed', flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">每页</Typography>
        <TextField
          select
          size="small"
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
          sx={{ width: 72 }}
        >
          {rowsPerPageOptions.map((n) => (
            <MenuItem key={n} value={n}>{n}</MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary">条</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary">
        第 {from}-{to} 条 · 共 {count} 条 · 第 {safePage + 1}/{totalPages} 页
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton size="small" disabled={safePage === 0} onClick={() => onPageChange(0)} aria-label="首页">
          <FirstPageIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" disabled={safePage === 0} onClick={() => onPageChange(safePage - 1)} aria-label="上一页">
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" disabled={safePage >= totalPages - 1} onClick={() => onPageChange(safePage + 1)} aria-label="下一页">
          <ChevronRightIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" disabled={safePage >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} aria-label="末页">
          <LastPageIcon fontSize="small" />
        </IconButton>
        <TextField
          size="small"
          placeholder="页码"
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleJump(); }}
          sx={{ width: 76, mx: 1 }}
        />
        <Button size="small" variant="outlined" onClick={handleJump} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
          跳转
        </Button>
      </Box>
    </Box>
  );
};

export default PaginationFooter;
