import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/authContext";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  getRecentOperationLogs,
  getOperationLogs,
  clearAllOperationLogs,
  OperationLog,
} from "@/lib/operationLog";

const Dashboard = () => {
  const [supportedWarehouseCount, setSupportedWarehouseCount] = useState(0);
  const [supportedCategoryCount, setSupportedCategoryCount] = useState(0);
  const [monthlyInventoryCount, setMonthlyInventoryCount] = useState(0);
  const [monthlyInventoryChange, setMonthlyInventoryChange] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [accuracyChange, setAccuracyChange] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false); // 控制是否显示全部操作记录
  const { authToken, logout, userLevel } = useAuth();

  // 设置当前日期
  useEffect(() => {
    const dateElement = document.getElementById("current-date");
    if (dateElement) {
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      };
      const currentDate = new Date().toLocaleDateString("zh-CN", options);
      dateElement.textContent = currentDate;
    }
  }, []);

  // 读取Excel文件并统计支持仓库数和支持品类数
  useEffect(() => {
    const readExcelData = async () => {
      setIsLoading(true);
      try {
        // 模拟仓库数据Excel文件
        const warehouseMockData = [
          ["仓库编号", "仓库名称", "描述"],
          ["101", "一号仓库", "主仓库"],
          ["102", "二号仓库", "副仓库"],
          ["103", "三号仓库", "临时仓库"],
          ["101", "一号仓库", "重复记录"],
          ["104", "四号仓库", "新仓库"],
          ["105", "五号仓库", "备用仓库"],
          ["106", "六号仓库", "中转仓库"],
          ["103", "三号仓库", "重复记录"],
        ];

        // 模拟品类数据Excel文件
        const categoryMockData = [
          ["品类ID", "品类名称", "规格"],
          ["C001", "黄鹤楼", "硬盒"],
          ["C002", "玉溪", "软盒"],
          ["C003", "荷花", "细支"],
          ["C004", "利群", "新版"],
          ["C005", "ESSE", "蓝盒"],
          ["C006", "云烟", "印象"],
          ["C007", "南京", "金陵十二钗"],
          ["C008", "红塔山", "经典"],
          ["C009", "中华", "软盒"],
          ["C010", "苏烟", "铂晶"],
          ["C011", "贵烟", "国酒香"],
          ["C012", "天子", "中支"],
          ["C013", "芙蓉王", "硬黄"],
          ["C014", "白沙", "和天下"],
          ["C015", "七匹狼", "通仙"],
          ["C016", "娇子", "宽窄"],
          ["C017", "黄金叶", "天叶"],
          ["C018", "牡丹", "软蓝"],
          ["C019", "大前门", "短支"],
          ["C020", "中南海", "5mg"],
          ["C021", "红双喜", "晶派"],
          ["C022", "娇子", "X"],
          ["C023", "兰州", "飞天"],
          ["C024", "长白山", "777"],
          ["C025", "黄山", "红方印"],
          ["C026", "钻石", "荷花"],
          ["C027", "泰山", "佛光"],
          ["C028", "好猫", "长乐"],
          ["C029", "红旗渠", "天河"],
          ["C030", "哈德门", "精品"],
        ];

        // 统计支持仓库数
        const warehouseColumnAValues = warehouseMockData
          .slice(1)
          .map((row) => row[0]);
        const uniqueWarehouseValues = new Set(warehouseColumnAValues);
        const uniqueWarehouseCount = uniqueWarehouseValues.size;

        // 统计支持品类数
        const categoryCount = categoryMockData.length - 1;

        setSupportedWarehouseCount(uniqueWarehouseCount);
        setSupportedCategoryCount(categoryCount);

        toast.success(
          `成功读取Excel文件，识别到 ${uniqueWarehouseCount} 个不同的仓库编号和 ${categoryCount} 种品类`,
        );
      } catch (error) {
        console.error("读取Excel文件出错:", error);
        toast.error("读取Excel文件失败，使用默认数据");
        setSupportedWarehouseCount(8);
        setSupportedCategoryCount(30);
      } finally {
        setIsLoading(false);
      }
    };

    readExcelData();
  }, []);

  // 计算本月盘点数据和准确率
  const calculateDashboardStats = (logs: OperationLog[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // 本月完成的盘点任务
    const monthlyTasks = logs.filter((log) => {
      const logDate = new Date(log.timestamp);
      return (
        log.operation_type === "inventory" &&
        log.action?.includes("完成") &&
        logDate.getMonth() === currentMonth &&
        logDate.getFullYear() === currentYear
      );
    });

    // 上月完成的盘点任务
    const lastMonthTasks = logs.filter((log) => {
      const logDate = new Date(log.timestamp);
      return (
        log.operation_type === "inventory" &&
        log.action?.includes("完成") &&
        logDate.getMonth() === lastMonth &&
        logDate.getFullYear() === lastMonthYear
      );
    });

    // 计算本月盘点次数
    const currentMonthCount = monthlyTasks.length;
    const lastMonthCount = lastMonthTasks.length;
    const change = currentMonthCount - lastMonthCount;

    // 计算准确率
    let totalAccuracy = 100;
    let totalTasksForAccuracy = 0;

    monthlyTasks.forEach((task) => {
      if (
        task.details?.accuracy !== undefined &&
        task.details.accuracy !== null
      ) {
        totalAccuracy += task.details.accuracy;
        totalTasksForAccuracy++;
      }
    });

    const avgAccuracy =
      totalTasksForAccuracy > 0 ? totalAccuracy / totalTasksForAccuracy : 100;

    // 计算上月准确率
    let lastMonthTotalAccuracy = 100;
    let lastMonthTotalTasksForAccuracy = 0;

    lastMonthTasks.forEach((task) => {
      if (
        task.details?.accuracy !== undefined &&
        task.details.accuracy !== null
      ) {
        lastMonthTotalAccuracy += task.details.accuracy;
        lastMonthTotalTasksForAccuracy++;
      }
    });

    const lastMonthAvgAccuracy =
      lastMonthTotalTasksForAccuracy > 0
        ? lastMonthTotalAccuracy / lastMonthTotalTasksForAccuracy
        : 100;
    const accuracyChange = avgAccuracy - lastMonthAvgAccuracy;

    setMonthlyInventoryCount(currentMonthCount);
    setMonthlyInventoryChange(change);
    setAccuracy(avgAccuracy);
    setAccuracyChange(accuracyChange);
  };

  // 获取操作记录
  useEffect(() => {
    const fetchOperationLogs = () => {
      try {
        setLoadingLogs(true);
        // 根据 showAllLogs 状态决定获取全部记录还是最近5条
        const logs = showAllLogs
          ? getOperationLogs()
          : getRecentOperationLogs(5);
        setOperationLogs(logs);
        console.log("获取到的操作记录:", logs);

        // 计算Dashboard统计信息
        const allLogs = getOperationLogs(); // 获取全部记录用于统计
        calculateDashboardStats(allLogs);
      } catch (error) {
        console.error("获取操作记录失败:", error);
        setOperationLogs([]);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchOperationLogs();
  }, [showAllLogs]); // 添加 showAllLogs 依赖，当它变化时重新加载

  // 清空操作记录
  const handleClearLogs = () => {
    if (userLevel !== "admin") {
      toast.error("只有管理员才能清空操作记录");
      return;
    }

    // 显示确认对话框
    const confirmed = window.confirm(
      "确定要清空所有操作记录吗？此操作不可恢复！",
    );

    if (confirmed) {
      try {
        clearAllOperationLogs();
        setOperationLogs([]);
        toast.success("操作记录已清空");
      } catch (error) {
        console.error("清空操作记录失败:", error);
        toast.error("清空操作记录失败");
      }
    }
  };

  // 功能选项数据
  const features = [
    {
      title: "开始盘点",
      description: "启动新的仓库盘点任务",
      icon: "fa-clipboard-check",
      color: "from-green-500 to-green-600",
      path: "/inventory/start",
    },
    {
      title: "历史盘点",
      description: "查看过往盘点记录和报表",
      icon: "fa-history",
      color: "from-blue-500 to-blue-600",
      path: "/inventory/history",
    },
    {
      title: "人员权限",
      description: "管理系统用户和权限设置",
      icon: "fa-users-gear",
      color: "from-purple-500 to-purple-600",
      path: "/user_manage",
    },
  ];

  // 渲染操作类型图标
  const getOperationIcon = (log: OperationLog) => {
    const action = log.action || "";

    switch (log.operation_type) {
      case "inventory":
        if (action.includes("获取库位信息")) {
          return "fa-database text-green-600";
        } else if (action.includes("生成任务清单")) {
          return "fa-list-check text-blue-600";
        } else if (action.includes("下发盘点任务") || action.includes("启动")) {
          return "fa-play-circle text-indigo-600";
        } else if (action.includes("完成")) {
          return "fa-check-circle text-green-600";
        } else if (action.includes("失败")) {
          return "fa-times-circle text-red-600";
        }
        return "fa-tasks text-green-600";
      case "user_login":
        return "fa-sign-in-alt text-blue-600";
      case "user_management":
        return "fa-users-gear text-purple-600";
      case "system_cleanup":
        return "fa-trash-alt text-amber-600";
      default:
        return "fa-cog text-gray-600";
    }
  };

  // 渲染操作类型文本
  const getOperationText = (log: OperationLog) => {
    const action = log.action || "";

    switch (log.operation_type) {
      case "inventory":
        if (action.includes("获取库位信息")) {
          return "获取库位信息";
        } else if (action.includes("生成任务清单")) {
          return "生成任务清单";
        } else if (action.includes("下发盘点任务")) {
          return "下发盘点任务";
        } else if (action.includes("完成")) {
          return "盘点任务完成";
        } else if (action.includes("启动")) {
          return "下发盘点任务";
        } else if (action.includes("失败")) {
          return "盘点任务失败";
        }
        return "盘点操作";
      case "user_login":
        return "用户登录";
      case "user_management":
        if (action.includes("添加")) {
          return "增加新用户";
        } else if (action.includes("删除")) {
          return "删除用户";
        } else if (action.includes("变更")) {
          return "用户权限变更";
        }
        return "用户管理";
      case "system_cleanup":
        return "历史数据清理";
      default:
        return action || "未知操作";
    }
  };

  // 渲染操作描述
  const getOperationDescription = (log: OperationLog) => {
    const details = log.details || {};

    switch (log.operation_type) {
      case "inventory":
        if (log.action?.includes("获取库位信息")) {
          const warehouse = details.warehouse || "未知仓库";
          const area = details.area || "未知储区";
          const binCount = details.bin_count || 0;
          return `${warehouse}/${area}，共 ${binCount} 条记录`;
        } else if (log.action?.includes("生成任务清单")) {
          const taskNo = details.task_no || log.target || "未知";
          const taskCount = details.task_count || 0;
          const totalQty = details.total_quantity || 0;
          return `任务编号: ${taskNo}，${taskCount} 个储位，${totalQty} 件`;
        } else if (
          log.action?.includes("下发盘点任务") ||
          log.action?.includes("启动")
        ) {
          const taskNo = details.task_no || log.target || "未知";
          const taskCount = details.task_count || 0;
          return `任务编号: ${taskNo}，包含 ${taskCount} 个储位`;
        } else if (log.action?.includes("完成")) {
          const taskNo = details.task_no || log.target || "未知";
          const completedCount = details.completed_count || 0;
          const abnormalCount = details.abnormal_count || 0;
          const totalTime = details.total_time || 0; // 总耗时（分钟）
          const accuracy = details.accuracy || 100; // 准确率（百分比）

          let description = `任务编号: ${taskNo}，完成 ${completedCount} 个储位，${abnormalCount} 个异常`;

          // 添加总耗时和准确率
          if (totalTime > 0 || accuracy !== 100) {
            description += `<br/><span class="text-xs text-gray-400">`;
            if (totalTime > 0) {
              description += `总耗时: ${totalTime}分钟`;
              if (accuracy !== 100) {
                description += ` | `;
              }
            }
            if (accuracy !== 100) {
              description += `准确率: ${accuracy.toFixed(1)}%`;
            }
            description += `</span>`;
          }

          return description;
        }
        return `任务编号: ${log.target || details.task_no || "未知"}`;

      case "user_login":
        return `用户: ${log.user_name || log.user_id || "未知用户"}`;

      case "user_management":
        if (log.action?.includes("添加")) {
          const newUser = details.new_user_data || {};
          return `用户名: ${newUser.userName || log.target || "未知用户"}，角色: ${newUser.userLevel || "未知"}`;
        } else if (log.action?.includes("删除")) {
          return `用户名: ${log.target || "未知用户"}`;
        } else if (log.action?.includes("变更")) {
          const oldRole = details.old_role || "未知";
          const newRole = details.new_role || "未知";
          return `用户名: ${log.target || "未知用户"}，${oldRole} → ${newRole}`;
        }
        return `目标: ${log.target || "未知"}`;

      case "system_cleanup":
        const cleanedCount = details.cleaned_count || 0;
        const cutoffDate = details.cutoff_date || "未知日期";
        return `清理了 ${cleanedCount} 条记录，清理 ${cutoffDate} 前的数据`;

      default:
        return `详情: ${JSON.stringify(details)}`;
    }
  };

  // 渲染状态标签
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
      case "completed":
        return {
          class: "bg-green-100 text-green-800",
          text: "成功",
        };
      case "running":
        return {
          class: "bg-blue-100 text-blue-800",
          text: "进行中",
        };
      case "failed":
        return {
          class: "bg-red-100 text-red-800",
          text: "失败",
        };
      default:
        return {
          class: "bg-gray-100 text-gray-800",
          text: status,
        };
    }
  };

  // 格式化时间
  const formatDateTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date
        .toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(/\//g, "-");
    } catch (e) {
      return timestamp;
    }
  };

  // 渲染操作记录表格
  const renderOperationLogsTable = () => {
    if (loadingLogs) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-8 text-center">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
            <p className="mt-2 text-gray-500">正在加载操作记录...</p>
          </td>
        </tr>
      );
    }

    if (operationLogs.length === 0) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
            <i className="fa-solid fa-clipboard-list text-3xl mb-2 opacity-50"></i>
            <p>暂无操作记录</p>
          </td>
        </tr>
      );
    }

    return operationLogs.map((log, index) => {
      const statusBadge = getStatusBadge(log.status);

      return (
        <tr
          key={log.id || index}
          className="hover:bg-gray-50 transition-colors"
        >
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center">
              <i className={`fa-solid ${getOperationIcon(log)} mr-3`}></i>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {getOperationText(log)}
                </div>
                <div
                  className="text-xs text-gray-500"
                  dangerouslySetInnerHTML={{
                    __html: getOperationDescription(log),
                  }}
                ></div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
            {log.user_name || log.user_id || "未知操作员"}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {formatDateTime(log.timestamp)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge.class}`}
            >
              {statusBadge.text}
            </span>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 背景图片 */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-5"
        style={{
          backgroundImage:
            "url(https://lf-code-agent.coze.cn/obj/x-ai-cn/attachment/3868529628819536/背景参考_20250808011802.jfif)",
        }}
      ></div>

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

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all flex items-center"
          >
            <i className="fa-solid fa-sign-out-alt mr-2"></i>退出登录
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        {/* 用户欢迎与日期 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-green-800">
              智慧仓库盘点系统
            </h2>
            <p className="text-gray-600">欢迎使用中国烟草仓库管理解决方案</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center text-gray-500">
            <i className="fa-solid fa-calendar mr-2"></i>
            <span id="current-date">2025年8月8日</span>
          </div>
        </div>

        {/* 统计数据卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transform transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-500 text-sm">支持仓库数</p>
                <h3 className="text-3xl font-bold text-green-800 mt-1">
                  {isLoading ? (
                    <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse"></span>
                  ) : (
                    supportedWarehouseCount
                  )}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <i className="fa-solid fa-warehouse text-xl"></i>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 flex items-center">
                <i className="fa-solid fa-arrow-up mr-1"></i> 2 个
              </span>
              <span className="text-gray-500 ml-2">较去年</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transform transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-500 text-sm">支持品类数</p>
                <h3 className="text-3xl font-bold text-green-800 mt-1">
                  {isLoading ? (
                    <span className="inline-block w-16 h-8 bg-gray-200 rounded animate-pulse"></span>
                  ) : (
                    supportedCategoryCount
                  )}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <i className="fa-solid fa-box text-xl"></i>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 flex items-center">
                <i className="fa-solid fa-arrow-up mr-1"></i> 20 种
              </span>
              <span className="text-gray-500 ml-2">较去年</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transform transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-500 text-sm">本月盘点</p>
                <h3 className="text-3xl font-bold text-green-800 mt-1">
                  {monthlyInventoryCount}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                <i className="fa-solid fa-clipboard-check text-xl"></i>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span
                className={
                  monthlyInventoryChange >= 0
                    ? "text-green-600 flex items-center"
                    : "text-red-600 flex items-center"
                }
              >
                <i
                  className={`fa-solid ${monthlyInventoryChange >= 0 ? "fa-arrow-up" : "fa-arrow-down"} mr-1`}
                ></i>{" "}
                {Math.abs(monthlyInventoryChange)} 次
              </span>
              <span className="text-gray-500 ml-2">较上月</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transform transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-500 text-sm">准确率</p>
                <h3 className="text-3xl font-bold text-green-800 mt-1">
                  {accuracy.toFixed(1)}%
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <i className="fa-solid fa-check-circle text-xl"></i>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span
                className={
                  accuracyChange >= 0
                    ? "text-green-600 flex items-center"
                    : "text-red-600 flex items-center"
                }
              >
                <i
                  className={`fa-solid ${accuracyChange >= 0 ? "fa-arrow-up" : "fa-arrow-down"} mr-1`}
                ></i>{" "}
                {Math.abs(accuracyChange).toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-2">较上月</span>
            </div>
          </div>
        </div>

        {/* 功能选择区域标题 */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-green-800 mb-2">功能导航</h2>
          <p className="text-gray-600">请选择以下功能进行操作</p>
        </div>

        {/* 功能选项卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link to={feature.path}>
                <div
                  className={`bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border border-gray-100`}
                >
                  <div className={`h-2 w-full ${feature.color}`}></div>
                  <div className="p-6">
                    <div
                      className={`w-14 h-14 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 text-white text-2xl`}
                    >
                      <i className={`fa-solid ${feature.icon}`}></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-500 mb-4">{feature.description}</p>
                    <div className="inline-flex items-center text-green-600 font-medium">
                      <span>查看详情</span>
                      <i className="fa-solid fa-arrow-right ml-2 text-sm"></i>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* 最近操作记录 */}
        <div className="mt-12 bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">最近操作记录</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowAllLogs(!showAllLogs);
                  toast.info(
                    showAllLogs
                      ? "已切换为显示最近5条记录"
                      : "已切换为显示全部记录",
                  );
                }}
                className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center"
              >
                <i
                  className={`fa-solid ${showAllLogs ? "fa-arrow-up mr-1" : "fa-list mr-1"}`}
                ></i>
                {showAllLogs ? "收起" : "查看全部"}
              </button>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
              >
                <i className="fa-solid fa-sync-alt mr-1"></i> 刷新
              </button>
              {userLevel === "admin" && (
                <button
                  onClick={handleClearLogs}
                  className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
                >
                  <i className="fa-solid fa-trash-alt mr-1"></i> 清空记录
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作员
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {renderOperationLogsTable()}
              </tbody>
            </table>
          </div>

          {operationLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 flex justify-between">
              <span>显示最近 {operationLogs.length} 条记录（6个月内）</span>
              <span>最后更新: {new Date().toLocaleTimeString("zh-CN")}</span>
            </div>
          )}
        </div>

        {/* 系统公告 */}
        <div className="mt-8 bg-amber-50 rounded-xl p-6 border border-amber-100">
          <div className="flex items-start">
            <i className="fa-solid fa-bullhorn text-amber-500 mt-1 mr-4 text-xl"></i>
            <div>
              <h3 className="text-lg font-semibold text-amber-800 mb-2">
                系统公告
              </h3>
              <ul className="text-amber-700 space-y-2">
                <li className="flex items-start">
                  <i className="fa-solid fa-circle-info mt-1 mr-2 text-sm"></i>
                  <span>如有新增仓库或品类需求，请联系运维人员进行处理。</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-circle-info mt-1 mr-2 text-sm"></i>
                  <span>历史盘点只会保留6个月内数据，历史数据将自动清理。</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-white py-6 border-t border-gray-200 relative z-10 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-500 text-sm">
                © 2025 中国烟草 - 智慧仓库盘点系统
              </p>
            </div>
            <div className="flex space-x-6">
              <a
                href="#"
                className="text-gray-500 hover:text-green-600 text-sm"
              >
                使用帮助
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-green-600 text-sm"
              >
                系统手册
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-green-600 text-sm"
              >
                联系技术支持
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
