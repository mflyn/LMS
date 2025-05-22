import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button, Badge, FAB, Dialog, Portal, TextInput } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import apiService from '../services/api';

const MeetingListScreen = ({ navigation }) => {
  const [meetings, setMeetings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('startDate'); // startDate, endDate

  // 新会议表单数据
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000), // 默认1小时后
    meetingType: '线上',
    parentId: '', // 实际应用中应从用户列表中选择
    studentId: '' // 实际应用中应从用户列表中选择
  });

  // 获取会议列表
  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.interaction.getMeetings();
      setMeetings(response.data);
    } catch (err) {
      setError('获取会议列表失败');
      console.error('获取会议列表失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 下拉刷新
  const onRefresh = () => {
    setRefreshing(true);
    fetchMeetings();
  };

  // 创建新会议
  const createMeeting = async () => {
    try {
      // 表单验证
      if (!formData.title || !formData.parentId || !formData.studentId) {
        alert('请填写必填字段');
        return;
      }

      const response = await apiService.interaction.createMeeting(formData);
      setDialogVisible(false);
      // 重置表单
      setFormData({
        title: '',
        description: '',
        startTime: new Date(),
        endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
        meetingType: '线上',
        parentId: '',
        studentId: ''
      });
      // 刷新会议列表
      fetchMeetings();
    } catch (err) {
      alert('创建会议失败: ' + (err.message || '请稍后再试'));
      console.error('创建会议失败:', err);
    }
  };

  // 查看会议详情
  const viewMeetingDetail = (meetingId) => {
    navigation.navigate('VideoMeeting', { meetingId });
  };

  // 处理日期时间选择
  const onDateTimeChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      setShowTimePicker(false);
      return;
    }
    
    const currentDate = selectedDate || (
      datePickerMode === 'startDate' ? formData.startTime : formData.endTime
    );
    
    if (datePickerMode === 'startDate') {
      setFormData({ ...formData, startTime: currentDate });
      // 如果开始时间晚于结束时间，自动调整结束时间
      if (currentDate > formData.endTime) {
        setFormData({
          ...formData,
          startTime: currentDate,
          endTime: new Date(currentDate.getTime() + 60 * 60 * 1000)
        });
      } else {
        setFormData({ ...formData, startTime: currentDate });
      }
    } else {
      // 如果结束时间早于开始时间，不允许设置
      if (currentDate < formData.startTime) {
        alert('结束时间不能早于开始时间');
        return;
      }
      setFormData({ ...formData, endTime: currentDate });
    }
    
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 获取会议状态对应的颜色
  const getStatusColor = (status) => {
    const colors = {
      '待确认': '#FF9800',
      '已确认': '#4CAF50',
      '已取消': '#F44336',
      '已完成': '#9E9E9E'
    };
    return colors[status] || '#9E9E9E';
  };

  // 组件挂载时获取会议列表
  useEffect(() => {
    fetchMeetings();
  }, []);

  // 渲染会议项
  const renderMeetingItem = ({ item }) => (
    <Card style={styles.meetingCard} onPress={() => viewMeetingDetail(item._id)}>
      <Card.Content>
        <View style={styles.meetingHeader}>
          <Title style={styles.meetingTitle}>{item.title}</Title>
          <Badge style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            {item.status}
          </Badge>
        </View>
        <Paragraph style={styles.meetingDesc} numberOfLines={2}>{item.description}</Paragraph>
        <View style={styles.meetingInfo}>
          <Text style={styles.meetingInfoItem}>开始时间: {formatDate(item.startTime)}</Text>
          <Text style={styles.meetingInfoItem}>会议类型: {item.meetingType}</Text>
          <Text style={styles.meetingInfoItem}>参与人: {item.teacher?.name}, {item.parent?.name}, {item.student?.name}</Text>
        </View>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => viewMeetingDetail(item._id)}>查看详情</Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={fetchMeetings} style={styles.retryButton}>
            重试
          </Button>
        </View>
      )}
      
      <FlatList
        data={meetings}
        renderItem={renderMeetingItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无会议</Text>
            </View>
          )
        }
      />
      
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => setDialogVisible(true)}
      />
      
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>创建新会议</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="会议标题"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              style={styles.input}
            />
            <TextInput
              label="会议描述"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.input}
            />
            
            <TouchableOpacity 
              onPress={() => {
                setDatePickerMode('startDate');
                setShowDatePicker(true);
              }}
              style={styles.datePickerButton}
            >
              <Text style={styles.datePickerLabel}>开始时间:</Text>
              <Text>{formatDate(formData.startTime)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => {
                setDatePickerMode('endDate');
                setShowDatePicker(true);
              }}
              style={styles.datePickerButton}
            >
              <Text style={styles.datePickerLabel}>结束时间:</Text>
              <Text>{formatDate(formData.endTime)}</Text>
            </TouchableOpacity>
            
            <TextInput
              label="家长ID"
              value={formData.parentId}
              onChangeText={(text) => setFormData({ ...formData, parentId: text })}
              style={styles.input}
            />
            
            <TextInput
              label="学生ID"
              value={formData.studentId}
              onChangeText={(text) => setFormData({ ...formData, studentId: text })}
              style={styles.input}
            />
            
            {showDatePicker && (
              <DateTimePicker
                value={datePickerMode === 'startDate' ? formData.startTime : formData.endTime}
                mode="date"
                display="default"
                onChange={onDateTimeChange}
              />
            )}
            
            {showTimePicker && (
              <DateTimePicker
                value={datePickerMode === 'startDate' ? formData.startTime : formData.endTime}
                mode="time"
                display="default"
                onChange={onDateTimeChange}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>取消</Button>
            <Button onPress={createMeeting}>创建</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
  },
  meetingCard: {
    marginBottom: 16,
    elevation: 2,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meetingTitle: {
    fontSize: 16,
    flex: 1,
  },
  statusBadge: {
    marginLeft: 8,
  },
  meetingDesc: {
    marginVertical: 8,
  },
  meetingInfo: {
    marginTop: 4,
  },
  meetingInfoItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#4a90e2',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginBottom: 12,
  },
  datePickerLabel: {
    fontWeight: 'bold',
  },
});

export default MeetingListScreen;