import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button, List } from 'react-native-paper';

const DashboardScreen = ({ navigation }) => {
  // 模拟数据
  const progressData = [
    { subject: '语文', completionRate: 75, status: 'in_progress' },
    { subject: '数学', completionRate: 90, status: 'in_progress' },
    { subject: '英语', completionRate: 60, status: 'in_progress' },
  ];

  const homeworkData = [
    { id: 1, subject: '语文', title: '阅读理解练习', dueDate: '2023-06-15' },
    { id: 2, subject: '数学', title: '几何题集', dueDate: '2023-06-16' },
    { id: 3, subject: '英语', title: '单词听写', dueDate: '2023-06-17' },
  ];

  const getStatusText = (status) => {
    const statusMap = {
      'not_started': '未开始',
      'in_progress': '进行中',
      'completed': '已完成',
      'reviewing': '复习中'
    };
    return statusMap[status] || status;
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>学习进度</Title>
          {progressData.map((item, index) => (
            <View key={index} style={styles.progressItem}>
              <View style={styles.progressHeader}>
                <Text style={styles.subjectText}>{item.subject}</Text>
                <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[styles.progressBar, { width: `${item.completionRate}%` }]} 
                />
                <Text style={styles.progressText}>{item.completionRate}%</Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>待完成作业</Title>
          {homeworkData.map((item) => (
            <List.Item
              key={item.id}
              title={item.title}
              description={`${item.subject} · 截止日期: ${item.dueDate}`}
              left={props => <List.Icon {...props} icon="book" />}
              right={props => <Button mode="text">查看</Button>}
              style={styles.homeworkItem}
            />
          ))}
        </Card.Content>
        <Card.Actions>
          <Button>查看全部作业</Button>
        </Card.Actions>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>最近错题</Title>
          <Paragraph>暂无错题记录</Paragraph>
        </Card.Content>
        <Card.Actions>
          <Button>查看错题本</Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  progressItem: {
    marginVertical: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subjectText: {
    fontWeight: 'bold',
  },
  statusText: {
    color: '#4a90e2',
  },
  progressBarContainer: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  progressText: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  homeworkItem: {
    paddingVertical: 4,
  },
});

export default DashboardScreen;