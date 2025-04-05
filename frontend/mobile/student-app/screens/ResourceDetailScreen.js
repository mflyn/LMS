import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import api from '../../../src/services/api';

export default function ResourceDetailScreen() {
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const route = useRoute();
  const { user } = useAuth();
  const { resourceId } = route.params;

  useEffect(() => {
    fetchResourceDetail();
  }, [resourceId]);

  const fetchResourceDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/resources/${resourceId}`);
      setResource(response.data);
      
      // 获取用户对该资源的评分（如果有）
      try {
        const ratingResponse = await api.get(`/resources/${resourceId}/ratings/${user.id}`);
        if (ratingResponse.data && ratingResponse.data.rating) {
          setUserRating(ratingResponse.data.rating);
        }
      } catch (ratingErr) {
        // 用户可能尚未评分，忽略错误
        console.log('用户尚未对该资源评分');
      }
    } catch (err) {
      console.error('获取资源详情失败', err);
      setError('获取资源详情失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // 在实际应用中，这里应该处理文件下载逻辑
      // 例如使用expo-file-system或react-native-fs
      await api.post(`/resources/${resourceId}/download`, { userId: user.id });
      Alert.alert('成功', '资源下载成功');
    } catch (err) {
      console.error('下载资源失败', err);
      Alert.alert('错误', '下载资源失败，请稍后再试');
    } finally {
      setDownloading(false);
    }
  };

  const handleRating = async (rating) => {
    try {
      await api.post(`/resources/${resourceId}/rate`, {
        userId: user.id,
        rating
      });
      setUserRating(rating);
      Alert.alert('成功', '评分已提交');
      fetchResourceDetail(); // 刷新资源详情，更新平均评分
    } catch (err) {
      console.error('提交评分失败', err);
      Alert.alert('错误', '提交评分失败，请稍后再试');
    }
  };

  const renderRatingStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity 
          key={i} 
          onPress={() => handleRating(i)}
          style={styles.starContainer}
        >
          <Ionicons 
            name={i <= userRating ? 'star' : 'star-outline'} 
            size={24} 
            color="#fadb14" 
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#ff4d4f" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchResourceDetail}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!resource) {
    return (
      <View style={styles.errorContainer}>
        <Text>资源不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badgeContainer}>
          <View style={styles.subjectBadge}>
            <Text style={styles.badgeText}>{resource.subject}</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.badgeText}>{resource.type}</Text>
          </View>
          <View style={styles.gradeBadge}>
            <Text style={styles.badgeText}>{resource.grade}</Text>
          </View>
        </View>
        <Text style={styles.title}>{resource.title}</Text>
        <View style={styles.metaInfo}>
          <Text style={styles.uploadInfo}>
            上传者: {resource.uploadedBy?.name || '系统'} | 
            {new Date(resource.uploadDate).toLocaleDateString()}
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.statItem}>
              <Ionicons name="eye-outline" size={16} color="#666" /> {resource.viewCount || 0}
            </Text>
            <Text style={styles.statItem}>
              <Ionicons name="download-outline" size={16} color="#666" /> {resource.downloadCount || 0}
            </Text>
            <Text style={styles.statItem}>
              <Ionicons name="star" size={16} color="#fadb14" /> {resource.averageRating?.toFixed(1) || '0.0'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>资源描述</Text>
        <Text style={styles.description}>{resource.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>资源信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>文件格式:</Text>
          <Text style={styles.infoValue}>{resource.fileFormat || '未知'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>文件大小:</Text>
          <Text style={styles.infoValue}>{resource.fileSize ? `${(resource.fileSize / 1024 / 1024).toFixed(2)} MB` : '未知'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>适用年级:</Text>
          <Text style={styles.infoValue}>{resource.grade || '所有年级'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>知识点:</Text>
          <Text style={styles.infoValue}>{resource.knowledgePoints?.join(', ') || '未标记'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>我的评分</Text>
        <View style={styles.ratingContainer}>
          {renderRatingStars()}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.downloadButton, downloading && styles.downloadingButton]}
        onPress={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <>
            <ActivityIndicator size="small" color="#fff" style={styles.downloadingIcon} />
            <Text style={styles.downloadButtonText}>下载中...</Text>
          </>
        ) : (
          <>
            <Ionicons name="download-outline" size={20} color="#fff" style={styles.downloadIcon} />
            <Text style={styles.downloadButtonText}>下载资源</Text>
          </>
        )}
      </TouchableOpacity>

      {resource.comments && resource.comments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>评论 ({resource.comments.length})</Text>
          {resource.comments.map((comment, index) => (
            <View key={index} style={styles.commentItem}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{comment.user?.name || '匿名用户'}</Text>
                <Text style={styles.commentDate}>{new Date(comment.date).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.commentContent}>{comment.content}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footer}></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    color: '#ff4d4f',
    marginTop: 10,
    marginBottom: 15,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1890ff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  subjectBadge: {
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  typeBadge: {
    backgroundColor: '#f9f0ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  gradeBadge: {
    backgroundColor: '#f6ffed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  metaInfo: {
    marginTop: 5,
  },
  uploadInfo: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    color: '#999',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starContainer: {
    marginRight: 8,
  },
  downloadButton: {
    backgroundColor: '#1890ff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    margin: 15,
    borderRadius: 4,
  },
  downloadingButton: {
    backgroundColor: '#91caff',
  },
  downloadIcon: {
    marginRight: 8,
  },
  downloadingIcon: {
    marginRight: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  commentContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    height: 20,
  },
});