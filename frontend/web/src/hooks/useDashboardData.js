import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useWebSocket } from '../contexts/WebSocketContext';

export const useDashboardData = (userRole, currentUser) => {
  const [dashboardData, setDashboardData] = useState({
    student: null,
    parent: null,
    teacher: null,
    admin: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { subscribe, unsubscribe } = useWebSocket();

  const fetchAllData = useCallback(async () => {
    if (!userRole || !currentUser) {
      // 如果角色或用户未定义，可能需要重置数据或不执行任何操作
      setDashboardData({ student: null, parent: null, teacher: null, admin: null });
      return;
    }

    setLoading(true);
    setError(null);
    let fetchedDataForRole = null;

    // --- Mock Data Functions (used as fallback if API calls fail) ---
    // TODO: Ensure mock data structures align with actual API responses for consistency during development/testing.

    // Mock data for student dashboard
    const getStudentMockData = () => {
      return {
        recentScores: [
          { subject: '语文', score: 92, date: '2023-10-15', trend: 'up' },
          { subject: '数学', score: 88, date: '2023-10-12', trend: 'down' },
        ],
        homeworkList: [
          { id: 1, title: '语文作文', subject: '语文', deadline: '2023-10-20', status: 'pending' },
        ],
        notifications: [
          { id: 1, title: '期中考试通知', content: '下周一开始期中考试', time: '2023-10-16 09:30', read: false },
        ],
        progressData: [{ subject: '语文', progress: 85 }],
        overallProgress: 80,
        completedHomework: 15,
        totalHomework: 20,
        pendingHomework: 5,
        averageScore: 91.2
      };
    };

    // Mock data for parent dashboard
    const getParentMockData = () => {
      return {
        children: [
          { id: 'child1', name: '张小明', grade: '三年级', class: '2班' },
          { id: 'child2', name: '张小红', grade: '一年级', class: '5班' },
        ],
        studyData: { // 默认展示第一个孩子的数据，或是一个通用结构
          child1: { // 使用 childId 作为 key
            recentScores: [{ subject: '语文', score: 92, date: '2023-10-15', trend: 'up' }],
            homeworkStatus: { completed: 15, pending: 3, overdue: 1 },
            attendance: { present: 45, absent: 2, late: 3 },
            teacherComments: [{ id: 1, teacher: '李老师', subject: '语文', content: '表现很好', date: '2023-10-14' }],
            averageScore: 92,
          },
          child2: {
            recentScores: [{ subject: '数学', score: 88, date: '2023-10-12', trend: 'down' }],
            homeworkStatus: { completed: 10, pending: 1, overdue: 0 },
            attendance: { present: 48, absent: 0, late: 1 },
            teacherComments: [{ id: 1, teacher: '王老师', subject: '数学', content: '继续努力', date: '2023-10-13' }],
            averageScore: 88,
          }
        },
      };
    };

    // Mock data for teacher dashboard
    const getTeacherMockData = () => {
      return {
        classStats: [
          { class: '三年级2班', studentCount: 45, avgScore: 87.5, homeworkCompletionRate: 92 },
        ],
        recentHomework: [
          { id: 1, title: '语文作文', class: '三年级2班', assignDate: '2023-10-15', dueDate: '2023-10-20', submittedCount: 38, totalCount: 45 },
        ],
        studentAlerts: [
          { id: 1, name: '王小明', class: '三年级2班', issue: '连续3次未交作业', severity: 'high' },
        ]
      };
    };

    // Mock data for admin dashboard
    const getAdminMockData = () => {
      return {
        schoolStats: { studentCount: 1250, teacherCount: 68, classCount: 30, avgAttendance: 96.5 },
        gradePerformance: [
          { grade: '一年级', avgScore: 92.5, passRate: 98.2 },
        ],
        systemAlerts: [
          { id: 1, type: '系统', message: '数据库备份已完成', time: '2023-10-16 03:00', severity: 'info' },
        ]
      };
    };
    // --- End of Mock Data Functions ---

    try {
      switch (userRole) {
        case 'student':
          try {
            // 调用API获取学生仪表盘数据
            const trendsResponse = await axios.get(`/api/analytics/trends/student/${currentUser._id}`);
            const progressResponse = await axios.get(`/api/analytics/progress/student/${currentUser._id}`);
            const homeworkResponse = await axios.get(`/api/homework/student/${currentUser._id}`);
            const notificationsResponse = await axios.get(`/api/notifications/user/${currentUser._id}`);
            
            // 处理API响应数据
            const recentScores = trendsResponse.data.trendsData ? 
              Object.entries(trendsResponse.data.trendsData).map(([subject, data]) => ({
                subject,
                score: data.scores && data.scores.length > 0 ? data.scores[data.scores.length - 1]?.score : 0,
                date: data.scores && data.scores.length > 0 ? data.scores[data.scores.length - 1]?.date : '',
                trend: data.trend === '上升' ? 'up' : data.trend === '下降' ? 'down' : 'stable'
              })).slice(0, 4) : [];
            
            const progressData = progressResponse.data.progressData ? 
              Object.entries(progressResponse.data.progressData).map(([subject, data]) => ({
                subject,
                progress: data.completionRate || 0
              })) : [];
            
            const homeworkList = homeworkResponse.data.homeworks || [];
            const notifications = notificationsResponse.data.notifications || [];
            
            // 计算总体进度和作业统计
            const overallProgress = progressData.length > 0 ? 
              progressData.reduce((sum, item) => sum + item.progress, 0) / progressData.length : 0;
            
            const completedHomework = homeworkList.filter(hw => hw.status === 'completed').length;
            const totalHomework = homeworkList.length;
            const pendingHomework = totalHomework - completedHomework;
            
            const averageScore = recentScores.length > 0 ? 
              recentScores.reduce((sum, item) => sum + item.score, 0) / recentScores.length : 0;
            
            fetchedDataForRole = {
              recentScores,
              homeworkList,
              notifications,
              progressData,
              overallProgress,
              completedHomework,
              totalHomework,
              pendingHomework,
              averageScore
            };
          } catch (apiError) {
            console.error('获取学生仪表盘API数据失败:', apiError);
            // 如果API调用失败，使用模拟数据作为备份
            fetchedDataForRole = getStudentMockData(); 
          }
          break;
        case 'parent':
          try {
            // 调用API获取家长仪表盘数据
            const childrenResponse = await axios.get(`/api/users/parent/${currentUser._id}/children`);
            const children = childrenResponse.data.children || [];
            
            // 为每个孩子获取详细的学习数据
            const childrenStudyData = {};
            if (children.length > 0) {
              for (const child of children) {
                try {
                  const trendsResponse = await axios.get(`/api/analytics/trends/student/${child.id}`);
                  const progressResponse = await axios.get(`/api/analytics/progress/student/${child.id}`);
                  const homeworkResponse = await axios.get(`/api/homework/student/${child.id}`);
                  const teacherCommentsResponse = await axios.get(`/api/comments/student/${child.id}`); // 假设有此API

                  const recentScores = trendsResponse.data.trendsData ? 
                    Object.entries(trendsResponse.data.trendsData).map(([subject, data]) => ({
                      subject,
                      score: data.scores && data.scores.length > 0 ? data.scores[data.scores.length - 1]?.score : 0,
                      date: data.scores && data.scores.length > 0 ? data.scores[data.scores.length - 1]?.date : '',
                      trend: data.trend === '上升' ? 'up' : data.trend === '下降' ? 'down' : 'stable'
                    })).slice(0, 3) : []; // 父仪表盘可能显示较少条目

                  const homeworkList = homeworkResponse.data.homeworks || [];
                  const completedHomework = homeworkList.filter(hw => hw.status === 'completed').length;
                  const pendingHomework = homeworkList.filter(hw => hw.status === 'pending').length;
                  const overdueHomework = homeworkList.filter(hw => hw.status === 'overdue').length; 
                  
                  const averageScore = recentScores.length > 0 ? 
                    recentScores.reduce((sum, item) => sum + item.score, 0) / recentScores.length : 0;

                  // 假设API返回出勤数据，或在此计算
                  const attendance = { present: 45, absent: 2, late: 3 }; // 示例数据，应替换为真实逻辑

                  childrenStudyData[child.id] = {
                    recentScores,
                    homeworkStatus: {
                      completed: completedHomework,
                      pending: pendingHomework,
                      overdue: overdueHomework,
                    },
                    attendance, // 示例，应来自API或计算
                    teacherComments: teacherCommentsResponse.data.comments || [],
                    averageScore: parseFloat(averageScore.toFixed(1)),
                    // ...还可以包括 progressData 等
                  };
                } catch (childApiError) {
                  console.error(`获取子女 ${child.id} 的仪表盘数据失败:`, childApiError);
                  // 可以为特定孩子设置错误状态或使用部分模拟数据
                  childrenStudyData[child.id] = getParentMockData().studyData[child.id] || {}; // 回退到该孩子的模拟数据
                }
              }
            }
            
            fetchedDataForRole = {
              children,
              studyData: childrenStudyData,
              // selectedChildId: children.length > 0 ? children[0].id : null, // selectedChild 逻辑在组件内处理更好
            };
          } catch (apiError) {
            console.error('获取家长仪表盘API数据失败:', apiError);
            fetchedDataForRole = getParentMockData(); 
          }
          break;
        case 'teacher':
          try {
            // 调用API获取教师仪表盘数据
            const classStatsResponse = await axios.get(`/api/analytics/teacher/${currentUser._id}/class-stats`);
            const recentHomeworkResponse = await axios.get(`/api/homework/teacher/${currentUser._id}/recent`);
            const studentAlertsResponse = await axios.get(`/api/alerts/teacher/${currentUser._id}/students`);

            // 假设API返回的数据结构与模拟数据类似
            fetchedDataForRole = {
              classStats: classStatsResponse.data.classStats || [],
              recentHomework: recentHomeworkResponse.data.recentHomework || [],
              studentAlerts: studentAlertsResponse.data.studentAlerts || [],
            };

          } catch (apiError) {
            console.error('获取教师仪表盘API数据失败:', apiError);
            fetchedDataForRole = getTeacherMockData();
          }
          break;
        case 'admin':
          try {
            // 调用API获取管理员仪表盘数据
            const schoolStatsResponse = await axios.get('/api/analytics/admin/school-stats');
            const gradePerformanceResponse = await axios.get('/api/analytics/admin/grade-performance');
            const systemAlertsResponse = await axios.get('/api/alerts/admin/system');
            
            // 假设API返回的数据结构与模拟数据类似
            fetchedDataForRole = {
              schoolStats: schoolStatsResponse.data.schoolStats || {},
              gradePerformance: gradePerformanceResponse.data.gradePerformance || [],
              systemAlerts: systemAlertsResponse.data.systemAlerts || [],
            };

          } catch (apiError) {
            console.error('获取管理员仪表盘API数据失败:', apiError);
            fetchedDataForRole = getAdminMockData();
          }
          break;
        default:
          console.warn('未知用户角色:', userRole);
          fetchedDataForRole = null;
      }
      setDashboardData(prevData => ({ ...prevData, [userRole]: fetchedDataForRole }));
    } catch (err) {
      console.error(`获取${userRole}仪表盘数据失败:`, err);
      setError(err);
      // 保留旧数据或设置为null，或者使用旧的模拟数据作为回退
      setDashboardData(prevData => ({ ...prevData, [userRole]: prevData[userRole] || null })); 
    } finally {
      setLoading(false);
    }
  }, [userRole, currentUser]); // currentUser._id 如果currentUser可能是null，需要保护

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // WebSocket 订阅逻辑
  useEffect(() => {
    // 确保关键依赖项存在，并且 currentUser 也有有效的标识 (例如 _id)
    if (!userRole || !currentUser?._id || !subscribe || !unsubscribe) {
      return;
    }

    let unsubs = []; // 用于存储所有取消订阅的函数

    // 根据 userRole 订阅不同事件，并更新 dashboardData
    switch (userRole) {
      case 'student':
        const unsubStudent = subscribe('student-trends-update', (data) => {
          if (data.studentId === currentUser._id) {
            setDashboardData(prev => {
              // 确保 prev.student 存在，避免在初始数据未加载完成时出错
              const prevStudentData = prev.student || {};
              return {
                ...prev,
                student: {
                  ...prevStudentData,
                  // 更新学生相关的特定字段，例如 recentScores
                  recentScores: data.trendsData ? 
                    Object.entries(data.trendsData).map(([subjectKey, subjectData]) => ({
                      subject: subjectKey,
                      score: subjectData.scores && subjectData.scores.length > 0 ? subjectData.scores[subjectData.scores.length - 1]?.score : 0,
                      date: subjectData.scores && subjectData.scores.length > 0 ? subjectData.scores[subjectData.scores.length - 1]?.date : '',
                      trend: subjectData.trend === '上升' ? 'up' : subjectData.trend === '下降' ? 'down' : 'stable'
                    })).slice(0, 4) 
                    : prevStudentData.recentScores, // 如果没有新数据，则保留旧的
                  // 还可以根据 data 更新其他学生相关的字段，例如通知、作业状态等
                  // notifications: data.newNotification ? [data.newNotification, ...(prevStudentData.notifications || [])] : prevStudentData.notifications,
                }
              };
            });
          }
        });
        unsubs.push(unsubStudent);
        break;
      case 'parent':
        // 家长可能需要根据其子女ID订阅多个事件
        // 这是一个复杂场景，因为 dashboardData.parent.children 可能会在初次加载后才确定
        // 理想情况下，订阅应该在 children 列表稳定后再进行，或者依赖 children 的 ID 列表
        if (dashboardData.parent?.children && Array.isArray(dashboardData.parent.children)) {
          dashboardData.parent.children.forEach(child => {
            if (child?.id) { // 确保 child 和 child.id 存在
              const unsubChild = subscribe(`student-data-update-${child.id}`, (data) => {
                // 假设 data 包含该 child 的完整更新数据或特定字段
                setDashboardData(prev => {
                  const prevParentData = prev.parent || { children: [], studyData: {} };
                  const prevStudyData = prevParentData.studyData || {};
                  return {
                    ...prev,
                    parent: {
                      ...prevParentData,
                      studyData: {
                        ...prevStudyData,
                        [child.id]: {
                          ...(prevStudyData[child.id] || {}),
                          ...data.updatedFields, // 假设 data.updatedFields 包含要更新的字段
                        }
                      }
                    }
                  };
                });
              });
              unsubs.push(unsubChild);
            }
          });
        }
        break;
      case 'teacher':
        // 假设教师 currentUser 对象有一个 classIds 数组，包含其管理的所有班级ID
        const teacherClassIds = currentUser.classIds || []; 
        // 示例：订阅每个班级的动态更新，例如作业提交、学生表现等
        teacherClassIds.forEach(classId => {
          const unsubClass = subscribe(`class-update-${classId}`, (data) => {
            // data 可能包含: { type: 'HOMEWORK_SUBMITTED', payload: { ... } } 
            // 或 { type: 'STUDENT_ALERT', payload: { ... } }
            setDashboardData(prev => {
              const prevTeacherData = prev.teacher || { classStats: [], recentHomework: [], studentAlerts: [] };
              // 根据 data.type 和 data.payload 更新 prevTeacherData 的相应部分
              // 例如，如果 data.type === 'HOMEWORK_STATUS_CHANGED',
              // 更新 prevTeacherData.recentHomework 中对应作业的提交数
              let updatedHomework = prevTeacherData.recentHomework;
              if (data.type === 'HOMEWORK_STATUS_CHANGED' && data.payload?.homeworkId) {
                updatedHomework = prevTeacherData.recentHomework.map(hw => 
                  hw.id === data.payload.homeworkId ? { ...hw, ...data.payload.changes } : hw
                );
              }
              // 例如，如果 data.type === 'NEW_STUDENT_ALERT'
              let updatedAlerts = prevTeacherData.studentAlerts;
              if (data.type === 'NEW_STUDENT_ALERT' && data.payload?.alert) {
                updatedAlerts = [data.payload.alert, ...prevTeacherData.studentAlerts];
              }

              return {
                ...prev,
                teacher: {
                  ...prevTeacherData,
                  recentHomework: updatedHomework,
                  studentAlerts: updatedAlerts,
                  // 可能还需要更新 classStats 等
                }
              };
            });
          });
          unsubs.push(unsubClass);
        });
        break;
      case 'admin':
        // 示例: 订阅系统级别的警报，例如新的错误日志或安全事件
        const unsubAdminSystem = subscribe('system-alert', (data) => {
          // data 可能包含 { type: 'error', message: '...', time: '...' } 
          // 或者 { type: 'security', event: '...', level: 'high' }
          setDashboardData(prev => {
            const prevAdminData = prev.admin || { schoolStats: {}, gradePerformance: [], systemAlerts: [] };
            return {
              ...prev,
              admin: { 
                ...prevAdminData, 
                systemAlerts: [data, ...(prevAdminData.systemAlerts || [])] // 将新警报添加到列表开头
               }
            };
          });
        });
        unsubs.push(unsubAdminSystem);
        
        // 还可以订阅例如用户注册、关键数据变更等事件
        // const unsubNewUser = subscribe('new-user-registered', (userData) => { ... });
        // unsubs.push(unsubNewUser);
        break;
      default:
        break;
    }

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
    // dashboardData.parent?.children 是一个复杂对象，直接作为依赖项可能导致频繁取消/重新订阅
    // 可以考虑更精细的依赖项，或者在fetchAllData成功后，dashboardData.parent.children稳定后再设置此effect
    // 目前依赖 currentUser._id, userRole, subscribe, unsubscribe, setDashboardData
    // 将 dashboardData.parent?.children 替换为更稳定的派生值
  }, [userRole, currentUser?._id, subscribe, unsubscribe, setDashboardData, dashboardData.parent?.children?.map(c => c.id).join(',') ?? '']);

  const refreshData = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { dashboardData, loading, error, refreshData };
}; 