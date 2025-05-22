import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Divider, IconButton, TextInput } from 'react-native-paper';
import { Rating } from 'react-native-ratings';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api';

const ResourceDetailScreen = ({ navigation, route }) => {
  const resourceId = route.params?.resourceId;
  
  const [resource, setResource] = useState(null);
  const [relatedResources, setRelatedResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // 获取资源详情
  const fetchResourceDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取资源详情
      const response = await apiService.resources.getById(resourceId);
      setResource(response.data);
      
      // 获取相关推荐资源
      const recommendedResponse = await apiService.resources.getRecommended({
        subject: response.data.subject,
        grade: response.data.grade,
        limit: 5
      });
      
      // 过滤掉当前资源
      const filtered = recommendedResponse.data.recommendedResources.filter(
        item => item._id !== resourceId
      );
      
      setRelatedResources(filtered);
    } catch (err) {
      setError('获取资源详情失败');
      console.error('获取资源详情失败:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 下载资源
  const downloadResource = async () => {
    try {
      setDownloading(true);
      await apiService.resources.downloadResource(resourceId);
      Alert.alert('下载成功', '资源已成功下载到您的设备');
    } catch (err) {
      Alert.alert('下载失败', '资源下载失败，请稍后重试');
      console.error('下载资源失败:', err);
    } finally {
      setDownloading(false);
    }
  };
  
  // 分享资源
  const shareResource = async () => {
    if (!resource) return;
    
    try {
      await Share.share({
        message: `查看这个学习资源：${resource.title}\n${resource.description}`,
        title: resource.title,
      });
    } catch (err) {
      console.error('分享资源失败:', err);
    }
  };
  
  // 提交评分
  const submitRating = async () => {
    if (userRating === 0) {
      Alert.alert('评分提示', '请先为资源评分');
      return;
    }
    
    try {
      setSubmittingReview(true);
      
      await apiService.resources.rateResource(resourceId, {
        rating: userRating,
        comment: userComment,
        isRecommended: userRating >= 3 // 3分以上视为推荐
      });
      
      Alert.alert('评分成功', '感谢您的评价！');
      
      // 重新获取资源详情，更新评分
      fetchResourceDetail();
      
      // 清空评论
      setUserComment('');
    } catch (err) {
      Alert.alert('评分失败', '提交评分失败，请稍后重试');
      console.error('提交评分失败:', err);
    } finally {
      setSubmittingReview(false);
    }
  };
  
  // 查看相关资源
  const viewRelatedResource = (relatedResourceId) => {
    navigation.push('ResourceDetail', { resourceId: relatedResourceId });
  };
  
  // 组件挂载时获取资源详情
  useEffect(() => {
    fetchResourceDetail();
  }, [resourceId]);
  
  // 渲染相关资源项
  const renderRelatedResourceItem = (item) => (
    <TouchableOpacity 
      key={item._id} 
      style={styles.relatedItem}
      onPress={() => viewRelatedResource(item._id)}
    >
      <Card style={styles.relatedCard}>
        <Card.Content>
          <Title style={styles.relatedTitle} numberOfLines={1}>{item.title}</Title>
          <View style={styles.relatedMeta}>
            <Chip style={styles.smallChip} textStyle={styles.smallChipText}>{item.subject}</Chip>
            <Chip style={styles.smallChip} textStyle={styles.smallChipText}>{item.type}</Chip>
          </View>
          <View style={styles.relatedRating}>
            <Rating
              readonly
              startingValue={item.averageRating || 0}
              imageSize={12}
              style={styles.smallRating}
            />
            <Text style={styles.smallRatingText}>
              {item.averageRating ? item.averageRating.toFixed(1) : '暂无评分'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
  
  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={fetchResourceDetail} style={styles.retryButton}>
          重试
        </Button>
      </View>
    );
  }
  
  if (!resource) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>资源不存在</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.retryButton}>
          返回
        </Button>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Card style={styles.resourceCard}>
        <Card.Content>
          <Title style={styles.resourceTitle}>{resource.title}</Title>
          
          <View style={styles.resourceMeta}>
            <Chip style={styles.chip}>{resource.subject}</Chip>
            <Chip style={styles.chip}>{resource.grade}</Chip>
            <Chip style={styles.chip}>{resource.type}</Chip>
          </View>
          
          <Paragraph style={styles.resourceDesc}>{resource.description}</Paragraph>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={16} color="#FFC107" />
              <Text style={styles.statText}>
                {resource.averageRating ? resource.averageRating.toFixed(1) : '暂无评分'}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="download-outline" size={16} color="#666" />
              <Text style={styles.statText}>{resource.downloads || 0}</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.statText}>{formatDate(resource.createdAt)}</Text>
            </View>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.fileInfoContainer}>
            <Text style={styles.fileInfoTitle}>文件信息</Text>
            <View style={styles.fileInfoItem}>
              <Text style={styles.fileInfoLabel}>文件名：</Text>
              <Text style={styles.fileInfoValue}>{resource.file?.name}</Text>
            </View>
            <View style={styles.fileInfoItem}>
              <Text style={styles.fileInfoLabel}>文件类型：</Text>
              <Text style={styles.fileInfoValue}>{resource.file?.type}</Text>
            </View>
            <View style={styles.fileInfoItem}>
              <Text style={styles.fileInfoLabel}>文件大小：</Text>
              <Text style={styles.fileInfoValue}>{formatFileSize(resource.file?.size || 0)}</Text>
            </View>
          </View>
          
          <View style={styles.actionButtons}>
            <Button 
              mode="contained" 
              icon="download" 
              onPress={downloadResource}
              loading={downloading}
              disabled={downloading}
              style={styles.downloadButton}
            >
              下载资源
            </Button>
            
            <IconButton
              icon="share-variant"
              size={24}
              onPress={shareResource}
              style={styles.shareButton}
            />
          </View>
        </Card.Content>
      </Card>
      
      <Card style={styles.ratingCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>评分与评论</Title>
          
          <Text style={styles.ratingLabel}>为这个资源评分：</Text>
          <Rating
            startingValue={userRating}
            onFinishRating={setUserRating}
            style={styles.ratingInput}
            imageSize={30}
          />
          
          <TextInput
            label="评论（可选）"
            value={userComment}
            onChangeText={setUserComment}
            multiline
            numberOfLines={3}
            style={styles.commentInput}
          />
          
          <Button 
            mode="contained" 
            onPress={submitRating}
            loading={submittingReview}
            disabled={submittingReview || userRating === 0}
            style={styles.submitButton}
          >
            提交评价
          </Button>
        </Card.Content>
      </Card>
      
      {relatedResources.length > 0 && (
        <Card style={styles.relatedResourcesCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>相关推荐</Title>
            <View style={styles.relatedList}>
              {relatedResources.map(renderRelatedResourceItem)}
            </View>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#F44336',
    marginBottom: 8,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 16,
  },
  resourceCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  resourceTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  resourceMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  resourceDesc: {
    marginVertical: 12,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  divider: {
    marginVertical: 12,
  },
  fileInfoContainer: {
    marginVertical: 8,
  },
  fileInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  fileInfoItem: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  fileInfoLabel: {
    width: 80,
    color: '#666',
  },
  fileInfoValue: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  downloadButton: {
    flex: 1,
    marginRight: 8,
  },
  shareButton: {
    backgroundColor: '#f0f0f0',
  },
  ratingCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  ratingLabel: {
    marginBottom: 8,
    fontSize: 14,
    color: '#666',
  },
  ratingInput: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  commentInput: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  submitButton: {
    marginTop: 8,
  },
  relatedResourcesCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 16,
    elevation: 2,
  },
  relatedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  relatedItem: {
    width: '48%',
    marginBottom: 8,
  },
  relatedCard: {
    elevation: 1,
  },
  relatedTitle: {
    fontSize: 14,
  },
  relatedMeta: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  smallChip: {
    marginRight: 4,
    height: 22,
  },
  smallChipText: {
    fontSize: 10,
  },
  relatedRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallRating: {
    alignItems: 'flex-start',
  },
  smallRatingText: {
    marginLeft: 4,
    fontSize: 10,
    color: '#666',
  },
});

export default ResourceDetailScreen;