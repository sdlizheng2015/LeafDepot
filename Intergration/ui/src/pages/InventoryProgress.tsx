/*
 * @Author: big box big box@qq.com
 * @Date: 2025-10-21 19:45:34
 * @LastEditors: lizh 447628890@qq.com
 * @LastEditTime: 2025-11-17 23:03:50
 * @FilePath: /Intergration/ui/src/pages/InventoryProgress.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by lizh, All Rights Reserved. 
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { GATEWAY_URL } from '@/config/ip_address'; // 导入常量
import { useAuth } from '@/contexts/authContext';

import { v4 as uuidv4 } from 'uuid';
import { createTaskGroupData } from '../hooks/taskUtils';
import { CreateTaskGroupRequest, TaskData, TargetRoute, ApiResponse } from '../hooks/types';


import img1 from '@/public/task1.jpg';
import img2 from '@/public/task2.jpg';
import img3 from '@/public/task3.jpg';
import img4 from '@/public/task4.jpg';
import img5 from '@/public/task5.jpg';

// 定义接口类型
interface InventoryItem {
  id: string;
  productName: string;
  specification: string;
  systemQuantity: number;
  actualQuantity: number | null;
  unit: string;
  locationId: string;
  locationName: string;
  taskNo: string; // 添加任务编号字段
}

interface LocationInfo {
  warehouseId: string;
  warehouseName: string;
  storageAreaId: string;
  storageAreaName: string;
  locationId: string;
  locationName: string;
}

// 盘点任务结构体
interface InventoryTask {
  taskNo: string;
  taskDetailId: string;
  binId: string;
  binDesc: string;
  binCode: string;
  itemId: string;
  itemCode: string;
  itemDesc: string;
  invQty: number;
  qtyUnit: string;
  countQty: number;
  status: string;
}

// 定义任务清单接口
interface TaskManifest {
  id: string;
  name?: string;
  createdAt: string;
  createdTimestamp?: number;
  taskCount: number;
  tasks: InventoryTask[];
  status: string;
  totalItems: number;
  progress?: {
    total: number;
    completed: number;
    pending: number;
    percentage: number;
  };
  statistics?: {
    totalItems: number;
    totalValue: number;
    locations: number;
    products: number;
  };
  metadata?: {
    createdBy: string;
    version: string;
    source: string;
  };
}

// 定义任务状态响应接口
interface TaskStatusResponse {
  success: boolean;
  data: {
    taskNo: string;
    status: string;
    totalTasks: number;
    completedTasks: number;
    progress: number;
    completedItems: Array<{
      taskDetailId: string;
      status: string;
      countedQty: number;
    }>;
  };
  message?: string;
}

// 盘点任务状态
const taskStatus = (status: string) => {
  switch (status) {
    case '1': return '未开始';
    case '2': return '进行中';
    case '3': return '已完成';
    case '4': return '异常任务状态';
    default: return '未开始';
  }
};

const img_index = 0;


export default function InventoryProgress() {
  // 统一使用 useAuth 钩子
  const { authToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false); // 为盘点任务添加单独的加载状态

  const navigate = useNavigate();
  const location = useLocation();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isIssuingTask, setIsIssuingTask] = useState(false); // 下发任务状态
  const [isStartingTask, setIsStartingTask] = useState(false); // 启动任务状态

  const [currentTaskNo, setCurrentTaskNo] = useState<string | null>(null); // 当前任务号
  // const [taskStatus, setTaskStatus] = useState<TaskStatusResponse['data'] | null>(null); // 任务状态

  // 新增状态：任务清单相关
  const [currentTaskManifest, setCurrentTaskManifest] = useState<TaskManifest | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  // 新增状态：图片显示相关
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isTaskStarted, setIsTaskStarted] = useState(false); // 任务是否已启动

  // 模拟任务图片路径数组 - 使用绝对路径从public目录开始
  const taskImages = [
    img1, img2, img3, img4, img5
  ];

  // 从本地存储获取任务清单并初始化盘点数据
  useEffect(() => {
    const loadTaskManifest = () => {
      try {
        const manifestData = localStorage.getItem('currentTaskManifest');
        if (manifestData) {
          const manifest: TaskManifest = JSON.parse(manifestData);
          setCurrentTaskManifest(manifest);

          // 如果任务清单中有任务，设置第一个任务的taskNo
          if (manifest.tasks.length > 0) {
            setCurrentTaskNo(manifest.tasks[0].taskNo);
          }

          // 根据任务清单初始化盘点数据
          const inventoryData: InventoryItem[] = manifest.tasks.map((task, index) => ({
            id: task.taskDetailId,
            productName: task.itemDesc || task.taskNo,
            specification: task.binDesc,
            systemQuantity: task.invQty,
            actualQuantity: null, // 初始状态下实际数量为空
            unit: task.qtyUnit,
            locationId: task.binId,
            locationName: task.binDesc,
            taskNo: task.taskNo // 保存任务编号
          }));

          setInventoryItems(inventoryData);
          toast.success(`已加载任务清单，包含 ${manifest.tasks.length} 个任务`);
        }
      } catch (error) {
        console.error('加载任务清单失败:', error);
      }
    };

    loadTaskManifest();
  }, []);

  // 在组件中添加这个 useEffect
  useEffect(() => {
    const handleImageError = () => {
      const imageContainer = document.querySelector('.relative.w-full.h-full.max-w-md.mx-auto');
      if (imageContainer) {
        const img = imageContainer.querySelector('img');
        const errorDiv = imageContainer.querySelector('.hidden.flex-col');

        if (img && errorDiv) {
          // 检查图片是否自然宽度为0（表示加载失败）
          if (img.naturalWidth === 0) {
            img.style.display = 'none';
            errorDiv.classList.remove('hidden');
            errorDiv.classList.add('flex');
          } else {
            img.style.display = 'block';
            errorDiv.classList.add('hidden');
            errorDiv.classList.remove('flex');
          }
        }
      }
    };

    // 添加全局错误监听
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      img.addEventListener('error', handleImageError);
      img.addEventListener('load', handleImageError);
    });

    // 初始检查
    handleImageError();

    return () => {
      images.forEach(img => {
        img.removeEventListener('error', handleImageError);
        img.removeEventListener('load', handleImageError);
      });
    };
  }, [currentImageIndex, isTaskStarted]);

  const handleStartCountingTask = async () => {
    setIsStartingTask(true);
    try {
      // 模拟启动任务
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 启动模拟盘点任务
      await simulateCountingTask();

      setIsTaskStarted(true);
      toast.success(`盘点任务启动成功`);
    } catch (error) {
      console.error('启动任务失败:', error);
      toast.error('启动任务失败');
    } finally {
      setIsStartingTask(false);
    }
  };

  const simulateCountingTask = async () => {
    if (!inventoryItems || inventoryItems.length === 0) {
      return;
    }

    for (let i = 0; i < inventoryItems.length; i++) {
      const delay = 2000 + Math.random() * 3000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // 为当前任务生成一个实际数量
      const actualQuantity = inventoryItems[i].systemQuantity;

      // 修正：在setInventoryItems的回调中同时更新进度和图片
      setInventoryItems(prevItems => {
        const newItems = [...prevItems];
        newItems[i] = { ...newItems[i], actualQuantity };

        // 计算完成数量（使用新状态）
        const completedCount = newItems.filter(item => item.actualQuantity !== null).length;
        const newProgress = (completedCount / newItems.length) * 100;

        // 同步更新进度和图片
        setProgress(Math.min(Math.round(newProgress), 100));

        setCurrentImageIndex((i) => (i + 1) % taskImages.length);

        return newItems;
      });

      toast.success(`任务 ${i + 1} 完成`);
    }
  };

  // 下发盘点任务
  const handleIssueCountingTask = async () => {

    // 演示，后续修改
    toast.success(`任务清单下发成功`);

    if (!currentTaskManifest || currentTaskManifest.tasks.length === 0) {
      toast.error('没有可下发的任务清单');
      return;
    }

    if (!currentTaskNo) {
      toast.error('无法获取任务号');
      return;
    }

    try {
      // 生成任务组数据
      // const taskGroupData: CreateTaskGroupRequest = createTaskGroupData();

      // 将 currentTaskManifest 中的任务转换为 RCS 任务组格式
      const taskData: TaskData[] = currentTaskManifest.tasks.map((task, index) => ({
        robotTaskCode: task.taskNo, // 使用 manifest 中的 taskNo
        sequence: index + 1 // 按顺序编号
      }));

      // 目标路由
      const targetRoute: TargetRoute = {
        type: "ZONE",
        code: "A3"
      };

      const taskGroupRequest: CreateTaskGroupRequest = {
        groupCode: currentTaskManifest.id,
        strategy: "GROUP_SEQ",
        strategyValue: "1", // 组间及组内都有序
        groupSeq: 10,
        targetRoute: targetRoute,
        data: taskData
      };

      console.log('发送的任务组数据:', JSON.stringify(taskGroupRequest, null, 2));

      // 调用网关接口
      const result = await fetch(`${GATEWAY_URL}/rcs/controller/task/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lr-request-id': uuidv4(),
          'x-lr-trace-id': uuidv4(),
        },
        body: JSON.stringify(taskGroupRequest)
      });

      const responseData: ApiResponse = await result.json();
      setResponse(responseData);

      if (responseData.code === 'SUCCESS') {
        toast.success(`任务清单下发成功`);

        console.log('任务清单下发成功');
      } else {
        console.warn('任务组下发返回业务异常:', responseData.message);
      }

    } catch (error) {
      console.error('下发任务清单失败:', error);
      toast.error(`任务清单下发失败: ${error.message}`);
    } finally {
      setIsIssuingTask(false);
    }
  };

  // 轮询任务状态
  const startPollingTaskStatus = () => {
    if (!currentTaskNo) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${GATEWAY_URL}/rcs/task-progress/${currentTaskNo}`, {
          method: 'GET',
          headers: {
            'authToken': authToken || '',
          },
        });

        if (response.ok) {
          const result: TaskStatusResponse = await response.json();
          if (result.success && result.data) {
            // setTaskStatus(result.data);

            // 更新进度
            setProgress(result.data.progress);

            // 如果任务完成，停止轮询
            if (result.data.status === 'COMPLETED' || result.data.progress >= 100) {
              clearInterval(pollInterval);
              toast.success('盘点任务已完成');
            }
          }
        }
      } catch (error) {
        console.error('获取任务状态失败:', error);
      }
    }, 3000); // 每3秒轮询一次

    // 10分钟后停止轮询
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 10 * 60 * 1000);
  };

  // 处理实际数量输入变化
  const handleActualQuantityChange = (id: string, value: string) => {
    const numericValue = value ? parseInt(value, 10) : null;

    setInventoryItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? { ...item, actualQuantity: numericValue }
          : item
      )
    );

    // 更新进度 - 每完成一个项目增加进度
    const completedCount = inventoryItems.filter(
      item => item.actualQuantity !== null && (item.id !== id || numericValue !== null)
    ).length;

    const newProgress = (completedCount / inventoryItems.length) * 100;
    setProgress(Math.min(Math.round(newProgress), 100));
  };

  // 处理行点击事件
  const handleRowClick = (index: number) => {
    if (!isTaskStarted) {
      toast.info('请先启动盘点任务');
      return;
    }
    setSelectedRowIndex(index);
    // 根据索引选择图片，循环使用图片数组
    setCurrentImageIndex(index % taskImages.length);
  };

  // 保存盘点结果到LMS
  const handleSaveInventoryToLMS = async () => {
    if (isSaving) return;
    try {
      setIsSaving(true);

      // 获取盘点结果数据 - 从任务清单中获取
      const inventoryResults = inventoryItems
        .filter(item => item.actualQuantity !== null)
        .map(item => ({
          taskDetailId: item.id,
          itemId: item.id.replace('INV', 'ITEM'), // 简单转换，实际应根据数据结构调整
          countQty: item.actualQuantity || 0,
        }));

      if (inventoryResults.length === 0) {
        toast.error('请先完成盘点数据录入');
        return;
      }

      const response = await fetch(`${GATEWAY_URL}/lms/setTaskResults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authToken': authToken || '',
        },
        body: JSON.stringify(inventoryResults),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('盘点结果已成功上传至LMS');
          setProgress(100);

          // 更新任务状态
          if (currentTaskNo) {
            startPollingTaskStatus();
          }
        } else {
          throw new Error(result.message || '上传失败');
        }
      } else {
        const errorText = await response.text();
        throw new Error(`LMS上传失败: ${errorText}`);
      }
    } catch (error) {
      console.error('上传盘点结果失败:', error);
      toast.error(`上传失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 处理保存盘点结果
  const handleSaveInventory = () => {
    // 检查是否所有项目都已输入实际数量
    const incompleteItems = inventoryItems.filter(item => item.actualQuantity === null);

    if (incompleteItems.length > 0) {
      toast.warning(`尚有 ${incompleteItems.length} 项未完成盘点，请完成后再保存`);
      return;
    }

    setIsSaving(true);

    // 模拟保存请求
    setTimeout(() => {
      setIsSaving(false);
      toast.success('盘点结果保存成功！');
    }, 1500);
  };

  // 处理返回按钮
  const handleBack = () => {
    navigate('/inventory/start');
  };

  // 修改任务详情显示/隐藏的处理函数
  const handleShowTaskDetails = () => {
    setShowTaskDetails(!showTaskDetails);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 背景图片 */}
      <div className="absolute inset-0 bg-cover bg-center opacity-5"
        style={{
          backgroundImage: 'url(https://lf-code-agent.coze.cn/obj/x-ai-cn/attachment/3868529628819536/背景参考_20250808011802.jfif)'
        }}>
      </div>

      {/* 顶部导航栏 */}
      <header className="relative bg-white shadow-md z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-boxes-stacked text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-green-800">中国烟草</h1>
              <p className="text-xs text-gray-500">智慧仓库盘点系统</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-all flex items-center"
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>返回
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        {/* 页面标题 */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-green-800 flex items-center">
            盘点任务
          </h2>
        </div>

        {/* 盘点进度 */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-green-800">
              <i className="fa-solid fa-chart-line mr-2 text-green-600"></i>盘点进度
            </h3>
            <span className="text-2xl font-bold text-green-700">{progress}%</span>
          </div>

          {/* 进度条 */}
          <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-green-700 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            ></motion.div>
          </div>

          {/* 操作按钮区域 */}
          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-gray-200">
            {/* 任务清单详情按钮 */}
            {currentTaskManifest && (
              <button
                onClick={handleShowTaskDetails}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all flex items-center"
              >
                <i className="fa-solid fa-list-check mr-2"></i>
                {showTaskDetails ? '盘点任务详情隐藏' : '盘点任务详情显示'}
              </button>
            )}

            {/* 下发盘点任务清单按钮 */}
            {currentTaskManifest && (
              <button
                onClick={handleIssueCountingTask}
                disabled={isIssuingTask}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-all flex items-center disabled:bg-orange-400"
              >
                {isIssuingTask ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>下发中...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-play mr-2"></i>下发盘点任务清单
                  </>
                )}
              </button>
            )}

            {/* 盘点任务启动按钮 */}
            {currentTaskManifest && (
              <button
                onClick={handleStartCountingTask}
                disabled={isStartingTask || isTaskStarted}
                className={`px-4 py-2 rounded-lg transition-all flex items-center ${isTaskStarted
                  ? 'bg-green-600 text-white cursor-default'
                  : isStartingTask
                    ? 'bg-orange-400 text-white cursor-not-allowed'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
              >
                {isStartingTask ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>启动中...
                  </>
                ) : isTaskStarted ? (
                  <>
                    <i className="fa-solid fa-check mr-2"></i>任务已启动
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-play mr-2"></i>启动盘点任务
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 任务详情表格显示区域 */}
        {showTaskDetails && currentTaskManifest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 bg-white rounded-xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-green-800 flex items-center">
                <i className="fa-solid fa-clipboard-list mr-2 text-green-600"></i>
                盘点任务详情
              </h3>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  任务数量: {currentTaskManifest.taskCount} 个
                </span>
              </div>
            </div>

            {/* 任务详情表格 */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务编号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">盘点库位</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">历史库存数量</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单位</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentTaskManifest?.tasks?.map((task, index) => {
                    // 添加数据验证，确保任务对象存在且包含必需字段
                    if (!task || !task.taskDetailId) {
                      console.warn('发现无效的任务数据:', task);
                      return null;
                    }

                    return (
                      <tr key={task.taskDetailId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {task.taskNo || '未知任务编号'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div>
                            <div className="font-medium">{task.binDesc || '未知库位'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                          {task.invQty || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {task.qtyUnit || '箱'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {taskStatus(task.status) || '未知状态'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* 盘点区域和实时观察区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧盘点数据区域 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-xl shadow-md border border-gray-100 h-full flex flex-col">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-green-800">
                  <i className="fa-solid fa-table mr-2 text-green-600"></i>盘点数据
                </h3>
              </div>

              {/* 表格区域 */}
              <div className="flex-1 overflow-auto p-6">
                {inventoryItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品规</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">库位</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">系统库存</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">实际库存</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">差异</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {inventoryItems.map((item, index) => {
                          const difference = item.actualQuantity !== null ? item.actualQuantity - item.systemQuantity : null;
                          const hasDifference = difference !== null && difference !== 0;
                          const isSelected = selectedRowIndex === index;

                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                }`}
                              onClick={() => handleRowClick(index)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.specification}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.systemQuantity}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.actualQuantity || ''}
                                  onChange={(e) => handleActualQuantityChange(item.id, e.target.value)}
                                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                                  placeholder="输入数量"
                                  disabled={!isTaskStarted} // 在任务启动前禁用输入
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {difference !== null ? (
                                  <span className={`text-sm font-medium ${hasDifference ? 'text-red-600' : 'text-green-600'}`}>
                                    {hasDifference ? (
                                      <>
                                        <i className="fa-solid fa-exclamation-circle mr-1"></i>
                                        {difference > 0 ? `+${difference}` : difference}
                                      </>
                                    ) : (
                                      <>
                                        <i className="fa-solid fa-check-circle mr-1"></i>
                                        一致
                                      </>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400">待输入</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <i className="fa-solid fa-box-open text-gray-400 text-4xl"></i>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">暂无盘点数据</h4>
                    <p className="text-gray-500 max-w-md">
                      请在"开始盘点"页面生成任务清单后进入此页面
                    </p>
                  </div>
                )}
              </div>

              {/* 底部操作栏 */}
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-4">
                <button
                  onClick={handleSaveInventory}
                  disabled={isSaving || progress < 100}
                  className={`px-6 py-3 rounded-lg transition-colors flex items-center ${progress < 100
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-700 hover:bg-green-800 text-white'
                    }`}
                >
                  {isSaving ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i> 保存中...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save mr-2"></i> 完成盘点并保存结果
                    </>
                  )}
                </button>

                <button
                  onClick={handleSaveInventoryToLMS}
                  disabled={isSaving}
                  className={`px-6 py-3 rounded-lg transition-colors flex items-center ${isSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-700 hover:bg-green-800 text-white'
                    }`}
                >
                  {isSaving ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i> 上传中...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save mr-2"></i> 上传盘点结果至LMS
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* 右侧实时观察窗口 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="bg-white rounded-xl shadow-md border border-gray-100 h-full flex flex-col">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-green-800 flex items-center">
                  <i className="fa-solid fa-eye mr-2 text-green-600"></i>实时观察窗口
                </h3>
              </div>

              {/* 图片显示区域 */}
              <div className="flex-1 p-6 flex items-center justify-center bg-gray-100 rounded-lg m-6 overflow-hidden">
                <div className="relative w-full h-full max-w-md mx-auto">
                  {isTaskStarted ? (
                    <>
                      <img
                        src={taskImages[currentImageIndex]}
                        alt={`任务 ${currentImageIndex + 1} 实时画面`}
                        className="w-full h-full object-contain rounded-lg shadow-lg border-2 border-green-700"
                        onError={(e) => {
                          // 图片加载失败时显示错误信息界面
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* 图片加载失败时显示的错误信息 */}
                      <div className="hidden flex-col items-center justify-center h-full text-center">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                          <i className="fa-solid fa-wifi text-gray-500 text-4xl"></i>
                        </div>
                        <h4 className="text-lg font-medium text-gray-700 mb-2">实时画面传输失败</h4>
                        <p className="text-gray-500 text-sm">请检查网络</p>
                      </div>
                      <div className="absolute bottom-4 right-4 bg-green-700 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center">
                        <i className="fa-solid fa-circle text-green-400 mr-2 animate-pulse"></i>
                        实时传输中
                      </div>
                      {/* 当前任务信息 */}
                      {selectedRowIndex !== null && inventoryItems[selectedRowIndex] && (
                        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white text-xs px-3 py-2 rounded-lg">
                          <div className="font-bold">当前任务: {inventoryItems[selectedRowIndex].taskNo}</div>
                          <div>库位: {inventoryItems[selectedRowIndex].specification}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                        <i className="fa-solid fa-camera text-gray-500 text-4xl"></i>
                      </div>
                      <h4 className="text-lg font-medium text-gray-700 mb-2">等待任务启动</h4>
                      <p className="text-gray-500 text-sm">
                        请先点击"启动盘点任务"按钮开始盘点
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 观察窗口控制 */}
              <div className="p-6 border-t border-gray-100 flex justify-center space-x-4">
                {isTaskStarted && (
                  <>
                    <button
                      className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                      onClick={() => setCurrentImageIndex((prev) => (prev - 1 + taskImages.length) % taskImages.length)}
                    >
                      <i className="fa-solid fa-arrow-left text-gray-700"></i>
                    </button>
                    <button className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                      <i className="fa-solid fa-search-plus text-gray-700"></i>
                    </button>
                    <button className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                      <i className="fa-solid fa-search-minus text-gray-700"></i>
                    </button>
                    <button
                      className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                      onClick={() => setCurrentImageIndex((prev) => (prev + 1) % taskImages.length)}
                    >
                      <i className="fa-solid fa-arrow-right text-gray-700"></i>
                    </button>
                    <button className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                      <i className="fa-solid fa-refresh text-gray-700"></i>
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-white py-6 border-t border-gray-200 relative z-10 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-500 text-sm">© 2025 中国烟草 - 智慧仓库盘点系统</p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-500 hover:text-green-600 text-sm">使用帮助</a>
              <a href="#" className="text-gray-500 hover:text-green-600 text-sm">系统手册</a>
              <a href="#" className="text-gray-500 hover:text-green-600 text-sm">联系技术支持</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}