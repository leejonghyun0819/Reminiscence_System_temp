// frontend/app/(tabs)/backup.tsx
import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Platform,
    Image,
    ActivityIndicator,
    TextInput,
    Modal,
    useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMemory, AnalysisVersion } from '../context/MemoryContext';
import { MouseDragHorizontalScroll } from '../features/backup/MouseDragHorizontalScroll';
import { CreateFolderModal } from '../features/backup/CreateFolderModal';
import { MoveFolderModal } from '../features/MoveFolderModal';
import { BackupDetailViewerModal, BackupAlbumMeta } from '../features/backup/BackupDetailViewerModal';
import { isVideoUrl } from '../utils/mediaProcessUtils';
import { MemoryAppHeader } from '../components/MemoryAppHeader';
import { MemoryPageHeader } from '../components/MemoryPageHeader';
import { memoryColors, memoryLayout } from '../constants/memoryTheme';

const BACKEND_URL = 'http://localhost:8000';

export interface ExtendedBackupAlbumMeta extends BackupAlbumMeta {
    mode?: 'travel' | 'childhood';
    rootCategory?: '유년시절' | '여행';
    curatedNote?: any;
    interviewData?: any;
}

type BackupRootCategory = '유년시절' | '여행' | '미분류';

export default function BackupPage({ onClose }: { onClose?: () => void }) {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isNarrow = width < 900;
    const { memoryList, fetchMemories, appendActiveMemory, appendActiveMemories } = useMemory();

    // AI 분류가 없는 레거시 앨범은 별도의 미분류 보관함에서 관리한다.
    const [activeRootCategory, setActiveRootCategory] = useState<BackupRootCategory>('유년시절');

    const [backupAlbums, setBackupAlbums] = useState<ExtendedBackupAlbumMeta[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [categorizedFolders, setCategorizedFolders] = useState<{
        [key: string]: string[];
    }>({
        유년시절: [],
        여행: [],
        childhood: [],
        travel: [],
    });
    const [selectedFolderTab, setSelectedFolderTab] = useState<string>('전체');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    const [loading, setLoading] = useState<boolean>(false);
    const [fetchError, setFetchError] = useState<boolean>(false);

    const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());

    // 모달 관리 상태
    const [viewingAlbum, setViewingAlbum] = useState<ExtendedBackupAlbumMeta | null>(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
    const [movingAlbum, setMovingAlbum] = useState<ExtendedBackupAlbumMeta | null>(null);
    const [isBatchMovingOpen, setIsBatchMovingOpen] = useState<boolean>(false);

    // 큰 폴더 이름 변경 모달 상태
    const [renameFolderModalOpen, setRenameFolderModalOpen] = useState<boolean>(false);
    const [targetFolderToRename, setTargetFolderToRename] = useState<string>('');
    const [newFolderNameInput, setNewFolderNameInput] = useState<string>('');

    // 개별 사진 파일명 관리 모달 상태
    const [fileManagerAlbum, setFileManagerAlbum] = useState<ExtendedBackupAlbumMeta | null>(null);
    const [editingTargetUrl, setEditingTargetUrl] = useState<string | null>(null);
    const [newFileNameInput, setNewFileNameInput] = useState<string>('');
    const [isRenamingFile, setIsRenamingFile] = useState<boolean>(false);

    const handleCloseOrBack = () => {
        if (onClose) onClose();
        else if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
    };

    const fetchBackupData = async () => {
        try {
            setLoading(true);
            setFetchError(false);
            const [albumsRes, foldersRes] = await Promise.all([
                fetch(`${BACKEND_URL}/api/backup-albums`),
                fetch(`${BACKEND_URL}/api/folders`),
            ]);

            if (albumsRes.ok) {
                const loadedAlbums: ExtendedBackupAlbumMeta[] = await albumsRes.json();
                setBackupAlbums(loadedAlbums);
            } else {
                setFetchError(true);
            }

            if (foldersRes.ok) {
                const fData = await foldersRes.json();
                if (fData.categorized) {
                    setCategorizedFolders(fData.categorized);
                    setFolders(fData.all || []);
                } else if (Array.isArray(fData)) {
                    setFolders(fData);
                }
            }
        } catch (e) {
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackupData();
        setSelectedAlbumIds(new Set());
        setViewingAlbum(null);
    }, []);

    const handleCreateFolder = async (name: string) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, rootCategory: activeRootCategory }),
            });
            if (res.ok) {
                await fetchBackupData();
                setSelectedFolderTab(name);
            }
        } catch (e) {
            alert('폴더 생성에 실패했습니다.');
        }
    };

    const handleOpenRenameFolder = (fName: string, e?: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
        setTargetFolderToRename(fName);
        setNewFolderNameInput(fName);
        setRenameFolderModalOpen(true);
    };

    const handleConfirmRenameFolder = async () => {
        if (!newFolderNameInput.trim()) {
            alert('변경할 폴더명을 입력해주세요.');
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${BACKEND_URL}/api/folders/${encodeURIComponent(targetFolderToRename)}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newName: newFolderNameInput.trim(),
                    rootCategory: activeRootCategory,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || '폴더 이름 변경에 실패했습니다.');
            }

            alert(`✨ 폴더명이 '${data.newName}'(으)로 변경되었습니다!`);
            setRenameFolderModalOpen(false);

            if (selectedFolderTab === targetFolderToRename) {
                setSelectedFolderTab(data.newName);
            }
            await fetchBackupData();
        } catch (err: any) {
            alert(err.message || '오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFolder = async (folderName: string, e?: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
        const ok =
            Platform.OS === 'web'
                ? window.confirm(
                      `'${folderName}' 폴더를 삭제하시겠습니까?\n(폴더 안의 앨범들은 '미분류'로 이동됩니다.)`,
                  )
                : true;
        if (!ok) return;

        try {
            await fetch(`${BACKEND_URL}/api/folders/${folderName}`, {
                method: 'DELETE',
            });
            if (selectedFolderTab === folderName) setSelectedFolderTab('전체');
            await fetchBackupData();
        } catch (e) {
            alert('폴더 삭제에 실패했습니다.');
        }
    };

    const handleMoveAlbumToFolder = async (albumId: string, folderName: string) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/backup-albums/${albumId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryFolder: folderName }),
            });
            if (res.ok) {
                setBackupAlbums((prev) =>
                    prev.map((a) => (a.id === albumId ? { ...a, categoryFolder: folderName } : a)),
                );
                setMovingAlbum(null);
                await fetchBackupData();
            }
        } catch (e) {
            alert('폴더 이동 실패');
        }
    };

    const handleBatchMoveAlbumsToFolder = async (folderName: string) => {
        if (selectedAlbumIds.size === 0) return;
        try {
            setLoading(true);
            const res = await fetch(`${BACKEND_URL}/api/backup-albums/batch-move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    albumIds: Array.from(selectedAlbumIds),
                    categoryFolder: folderName,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                alert(`✨ ${data.movedCount}개의 앨범이 '${folderName}' 폴더로 일괄 이동되었습니다!`);
                setIsBatchMovingOpen(false);
                setSelectedAlbumIds(new Set());
                await fetchBackupData();
                setSelectedFolderTab(folderName);
            }
        } catch (e) {
            alert('일괄 폴더 이동 실패');
        } finally {
            setLoading(false);
        }
    };

    const isAlreadyInIndex = (backupAlbum: ExtendedBackupAlbumMeta): boolean => {
        return memoryList.some((active) => {
            if (active.id === backupAlbum.id || active.id.includes(backupAlbum.id)) return true;
            if (
                active.analysis?.title &&
                active.analysis.title === backupAlbum.analysis?.title &&
                active.imageUrls.length === backupAlbum.imageUrls.length
            ) {
                return true;
            }
            return false;
        });
    };

    const handleRestoreSingle = async (album: ExtendedBackupAlbumMeta) => {
        if (isAlreadyInIndex(album)) {
            alert('⚠️ 이미 현재 작업 화면(인덱스 목록)에 추가되어 있는 추억 앨범입니다.');
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${BACKEND_URL}/api/backup-albums/${album.id}/restore`, {
                method: 'POST',
            });
            if (res.ok) {
                const data = await res.json();
                appendActiveMemory(data.restoredItem);
                alert('✨ 현재 작업 화면(홈)으로 추억 앨범이 성공적으로 복원되었습니다!');
                handleCloseOrBack();
            } else alert('복원에 실패했습니다.');
        } catch (e) {
            alert('복원 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleRollbackToHistoryVersion = async (targetVer: AnalysisVersion) => {
        if (!viewingAlbum) return;
        const ok = window.confirm(
            `이 앨범의 현재 분석 내용을 '버전 ${targetVer.version}'의 내용으로 되돌리시겠습니까?`,
        );
        if (!ok) return;

        try {
            setLoading(true);
            const payload = {
                title: targetVer.title,
                location: targetVer.location,
                yearEstimate: targetVer.yearEstimate,
                description: targetVer.description,
                storyCaption: targetVer.storyCaption,
            };

            const res = await fetch(`${BACKEND_URL}/api/memories/${viewingAlbum.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const updatedAlbum: ExtendedBackupAlbumMeta = {
                    ...viewingAlbum,
                    analysis: {
                        ...viewingAlbum.analysis,
                        ...payload,
                    },
                };
                setViewingAlbum(updatedAlbum);
                await fetchBackupData();
                alert(`✨ 버전 ${targetVer.version}의 내용으로 앨범이 성공적으로 롤백되었습니다!`);
            }
        } catch (err) {
            alert('롤백 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteHistoryFromBackup = async (versionNum: number, e?: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!viewingAlbum) return;

        const ok = window.confirm(`버전 ${versionNum} 기록을 영구 삭제하시겠습니까?`);
        if (!ok) return;

        try {
            setLoading(true);
            const res = await fetch(`${BACKEND_URL}/api/memories/${viewingAlbum.id}/history/${versionNum}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                const data = await res.json();
                const reorderedHistory: AnalysisVersion[] = data.history || [];
                setViewingAlbum((prev) => (prev ? { ...prev, history: reorderedHistory } : null));
                setBackupAlbums((prevList) =>
                    prevList.map((a) => (a.id === viewingAlbum.id ? { ...a, history: reorderedHistory } : a)),
                );
            }
        } catch (err) {
            alert('히스토리 삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchRestore = async () => {
        if (selectedAlbumIds.size === 0) return;
        const selectedAlbums = backupAlbums.filter((album) => selectedAlbumIds.has(album.id));
        const targetToRestore = selectedAlbums.filter((album) => !isAlreadyInIndex(album));

        if (targetToRestore.length === 0) {
            alert('⚠️ 선택한 모든 앨범이 이미 현재 작업 화면(인덱스 목록)에 존재합니다.');
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${BACKEND_URL}/api/backup-albums/batch-restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ albumIds: targetToRestore.map((a) => a.id) }),
            });

            if (res.ok) {
                const data = await res.json();
                appendActiveMemories(data.restoredItems);
                alert(`✨ 선택한 ${data.restoredItems.length}개의 앨범이 복원되었습니다!`);
                setSelectedAlbumIds(new Set());
                handleCloseOrBack();
            }
        } catch (e) {
            alert('일괄 복원 오류');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedAlbumIds.size === 0) return;
        const requestedIds = Array.from(selectedAlbumIds);
        const ok =
            Platform.OS === 'web'
                ? window.confirm(`선택한 ${requestedIds.length}개의 앨범과 실제 저장 파일을 영구 삭제하시겠습니까?`)
                : true;
        if (!ok) return;

        try {
            setLoading(true);
            const res = await fetch(`${BACKEND_URL}/api/backup-albums/batch-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ albumIds: requestedIds }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.detail || '앨범 일괄 삭제에 실패했습니다.');
            }

            await Promise.all([fetchBackupData(), fetchMemories()]);

            const failedIds: string[] = Array.isArray(data.failedIds) ? data.failedIds : [];
            setSelectedAlbumIds(new Set(failedIds));

            const cleanupIssueCount = Array.isArray(data.results)
                ? data.results.reduce(
                      (count: number, item: any) =>
                          count + (Array.isArray(item.cleanupErrors) ? item.cleanupErrors.length : 0),
                      0,
                  )
                : 0;

            if (failedIds.length > 0 || cleanupIssueCount > 0) {
                const messages = [
                    `${data.deletedCount || 0}개 앨범 삭제 완료`,
                    failedIds.length > 0 ? `${failedIds.length}개 앨범 삭제 실패` : '',
                    cleanupIssueCount > 0 ? `${cleanupIssueCount}개 보조 파일/DB 정리 항목 확인 필요` : '',
                ].filter(Boolean);
                alert(`일부 항목만 처리되었습니다.\n${messages.join('\n')}`);
            } else {
                alert(`${data.deletedCount || requestedIds.length}개 앨범과 실제 저장 파일을 삭제했습니다.`);
            }
        } catch (err: any) {
            alert(err.message || '앨범 일괄 삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSingle = async (albumId: string) => {
        const ok = Platform.OS === 'web' ? window.confirm('이 앨범과 실제 저장 파일을 영구 삭제하시겠습니까?') : true;
        if (!ok) return;

        try {
            setLoading(true);
            const res = await fetch(`${BACKEND_URL}/api/backup-albums/${encodeURIComponent(albumId)}`, {
                method: 'DELETE',
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.detail || '앨범 삭제에 실패했습니다.');
            }

            await Promise.all([fetchBackupData(), fetchMemories()]);

            if (data.status === 'partial') {
                const details = Array.isArray(data.cleanupErrors) ? data.cleanupErrors.join('\n') : '';
                alert(`앨범 폴더는 삭제했지만 일부 정리가 필요합니다.${details ? `\n${details}` : ''}`);
            } else {
                alert('앨범과 실제 저장 파일을 삭제했습니다.');
            }
        } catch (err: any) {
            alert(err.message || '삭제 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteRenameFile = async (oldUrl: string) => {
        if (!fileManagerAlbum || !newFileNameInput.trim()) {
            alert('새로운 파일명을 입력해주세요.');
            return;
        }

        const rawOldName = oldUrl.split('/').pop() || oldUrl;

        setIsRenamingFile(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/backup-albums/${fileManagerAlbum.id}/rename-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldFileName: rawOldName,
                    newFileName: newFileNameInput.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || '파일명 변경에 실패했습니다.');
            }

            alert(`✨ '${data.oldFileName}'이 '${data.newFileName}'으로 변경되었습니다!`);
            setEditingTargetUrl(null);
            setNewFileNameInput('');

            await fetchBackupData();
            setFileManagerAlbum((prev) => {
                if (!prev) return null;
                const updatedUrls = prev.imageUrls.map((u) =>
                    u.includes(data.oldFileName) ? u.replace(data.oldFileName, data.newFileName) : u,
                );
                return { ...prev, imageUrls: updatedUrls };
            });
        } catch (err: any) {
            alert(err.message || '오류가 발생했습니다.');
        } finally {
            setIsRenamingFile(false);
        }
    };

    // 백엔드의 한글/영문 키를 모두 고려한 서브 폴더 목록 매핑
    const currentSubFolders =
        activeRootCategory === '유년시절'
            ? categorizedFolders['유년시절'] || categorizedFolders['childhood'] || []
            : activeRootCategory === '여행'
              ? categorizedFolders['여행'] || categorizedFolders['travel'] || []
              : [];

    // 명시적인 mode를 최우선으로 사용하고 rootCategory, 저장 경로 순서로 보완한다.
    // 어느 곳에서도 근거를 찾지 못한 과거 앨범만 '미분류'로 보낸다.
    const resolveAlbumRoot = (album: ExtendedBackupAlbumMeta): BackupRootCategory => {
        if (album.mode === 'travel') return '여행';
        if (album.mode === 'childhood') return '유년시절';
        if (album.rootCategory === '여행') return '여행';
        if (album.rootCategory === '유년시절') return '유년시절';

        const hasTravelPath = album.imageUrls?.some((u) => u.includes('/여행/') || u.includes('/travel/'));
        if (hasTravelPath) return '여행';

        const hasChildhoodPath = album.imageUrls?.some((u) => u.includes('/유년시절/') || u.includes('/childhood/'));
        if (hasChildhoodPath) return '유년시절';

        return '미분류';
    };

    const rootCategoryCounts = backupAlbums.reduce<Record<BackupRootCategory, number>>(
        (counts, album) => {
            counts[resolveAlbumRoot(album)] += 1;
            return counts;
        },
        { 유년시절: 0, 여행: 0, 미분류: 0 },
    );

    const filteredAlbums = backupAlbums.filter((album) => {
        if (resolveAlbumRoot(album) !== activeRootCategory) return false;

        const folderMatch =
            selectedFolderTab === '전체'
                ? true
                : selectedFolderTab === '미분류'
                  ? !album.categoryFolder || album.categoryFolder === '미분류'
                  : album.categoryFolder === selectedFolderTab;

        if (!folderMatch) return false;

        if (!searchKeyword.trim()) return true;
        const kw = searchKeyword.toLowerCase();
        const title = (album.curatedNote?.title || album.analysis?.title || '').toLowerCase();
        const loc = (album.analysis?.location || '').toLowerCase();
        const desc = (album.curatedNote?.sceneDescription || album.analysis?.description || '').toLowerCase();
        return title.includes(kw) || loc.includes(kw) || desc.includes(kw);
    });

    const isAllSelected = filteredAlbums.length > 0 && filteredAlbums.every((item) => selectedAlbumIds.has(item.id));

    return (
        <View style={styles.pageContainer}>
            <MemoryAppHeader />
            <View style={[styles.modalCard, isNarrow && styles.modalCardNarrow]}>
                {/* 상단 헤더 */}
                <View style={styles.headerRow}>
                    <MemoryPageHeader
                        title="백업 보관함"
                        subtitle="저장한 원본 추억을 폴더별로 정리하고 인터뷰 내용을 다시 확인하세요."
                    />
                    <TouchableOpacity style={styles.backToHomeBtn} onPress={handleCloseOrBack}>
                        <Text style={styles.backToHomeBtnText}>추억 수집으로</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.backupWorkspace, isNarrow && styles.backupWorkspaceNarrow]}>
                    <View style={[styles.folderSidebar, isNarrow && styles.folderSidebarNarrow]}>
                        <Text style={styles.sidebarTitle}>내 폴더</Text>
                        {/* 대분류 전환 탭 */}
                        <View style={styles.rootCategoryBar}>
                            <TouchableOpacity
                                style={[
                                    styles.rootTabBtn,
                                    activeRootCategory === '유년시절' && styles.rootTabBtnActive,
                                ]}
                                onPress={() => {
                                    setActiveRootCategory('유년시절');
                                    setSelectedFolderTab('전체');
                                }}
                            >
                                <Text
                                    style={[
                                        styles.rootTabBtnText,
                                        activeRootCategory === '유년시절' && styles.rootTabBtnTextActive,
                                    ]}
                                >
                                    {'🧸 유년 시절 (' + rootCategoryCounts['유년시절'] + ')'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.rootTabBtn, activeRootCategory === '여행' && styles.rootTabBtnActive]}
                                onPress={() => {
                                    setActiveRootCategory('여행');
                                    setSelectedFolderTab('전체');
                                }}
                            >
                                <Text
                                    style={[
                                        styles.rootTabBtnText,
                                        activeRootCategory === '여행' && styles.rootTabBtnTextActive,
                                    ]}
                                >
                                    {'✈️ 여행 (' + rootCategoryCounts['여행'] + ')'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.rootTabBtn, activeRootCategory === '미분류' && styles.rootTabBtnActive]}
                                onPress={() => {
                                    setActiveRootCategory('미분류');
                                    setSelectedFolderTab('전체');
                                }}
                            >
                                <Text
                                    style={[
                                        styles.rootTabBtnText,
                                        activeRootCategory === '미분류' && styles.rootTabBtnTextActive,
                                    ]}
                                >
                                    {'❓ 미분류 (' + rootCategoryCounts['미분류'] + ')'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* 검색창 & 새 폴더 만들기 */}
                        <View style={styles.folderActionBar}>
                            <View style={styles.searchBox}>
                                <Text style={{ fontSize: 14 }}>🔍</Text>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={`[${activeRootCategory}] 제목, 위치, 사연 검색...`}
                                    placeholderTextColor="#94A3B8"
                                    value={searchKeyword}
                                    onChangeText={setSearchKeyword}
                                />
                                {searchKeyword.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchKeyword('')}>
                                        <Text
                                            style={{
                                                color: '#94A3B8',
                                                fontSize: 13,
                                                fontWeight: '700',
                                            }}
                                        >
                                            ✕
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {activeRootCategory !== '미분류' && (
                                <TouchableOpacity
                                    style={styles.createFolderBtn}
                                    onPress={() => setIsFolderModalOpen(true)}
                                >
                                    <Text
                                        style={styles.createFolderBtnText}
                                    >{`📁 새 ${activeRootCategory} 폴더 +`}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* 미분류는 과거 앨범을 한곳에서 정리하는 영역이므로 하위 폴더 탭을 만들지 않는다. */}
                        {activeRootCategory !== '미분류' && (
                            <View style={styles.folderTabWrapper}>
                                <View style={styles.folderList}>
                                    <TouchableOpacity
                                        style={[
                                            styles.folderTab,
                                            selectedFolderTab === '전체' && styles.folderTabActive,
                                        ]}
                                        onPress={() => setSelectedFolderTab('전체')}
                                    >
                                        <Text
                                            style={[
                                                styles.folderTabText,
                                                selectedFolderTab === '전체' && styles.folderTabTextActive,
                                            ]}
                                        >
                                            {`🗂️ 전체 (${filteredAlbums.length})`}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.folderTab,
                                            selectedFolderTab === '미분류' && styles.folderTabActive,
                                        ]}
                                        onPress={() => setSelectedFolderTab('미분류')}
                                    >
                                        <Text
                                            style={[
                                                styles.folderTabText,
                                                selectedFolderTab === '미분류' && styles.folderTabTextActive,
                                            ]}
                                        >
                                            {`📄 미분류 (${filteredAlbums.filter((a) => !a.categoryFolder || a.categoryFolder === '미분류').length})`}
                                        </Text>
                                    </TouchableOpacity>

                                    {currentSubFolders.map((fName) => {
                                        const count = filteredAlbums.filter((a) => a.categoryFolder === fName).length;
                                        const isActive = selectedFolderTab === fName;
                                        return (
                                            <View key={fName} style={styles.customFolderTabContainer}>
                                                <TouchableOpacity
                                                    style={[styles.folderTab, isActive && styles.folderTabActive]}
                                                    onPress={() => setSelectedFolderTab(fName)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.folderTabText,
                                                            isActive && styles.folderTabTextActive,
                                                        ]}
                                                    >
                                                        {`📁 ${fName} (${count})`}
                                                    </Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.folderRenameSmallBtn}
                                                    onPress={(e) => handleOpenRenameFolder(fName, e)}
                                                >
                                                    <Text style={{ fontSize: 10, color: '#0284C7' }}>✏️</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.folderDeleteSmallBtn}
                                                    onPress={(e) => handleDeleteFolder(fName, e)}
                                                >
                                                    <Text style={{ fontSize: 10, color: '#DC2626' }}>✕</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                    </View>
                    <View style={styles.albumArea}>
                        <View style={styles.albumAreaHeader}>
                            <Text style={styles.albumAreaTitle}>
                                {selectedFolderTab === '전체' ? '전체 추억' : selectedFolderTab}
                            </Text>
                            <Text style={styles.albumCountBadge}>{`${filteredAlbums.length}개 앨범`}</Text>
                        </View>

                        {/* 툴바 */}
                        <View style={styles.toolbarRow}>
                            <TouchableOpacity
                                style={styles.selectAllBtn}
                                onPress={() => {
                                    if (isAllSelected) setSelectedAlbumIds(new Set());
                                    else setSelectedAlbumIds(new Set(filteredAlbums.map((a) => a.id)));
                                }}
                            >
                                <Text style={styles.selectAllBtnText}>
                                    {isAllSelected ? '선택 해제 ✕' : '전체 선택 ✓'}
                                </Text>
                            </TouchableOpacity>

                            {selectedAlbumIds.size > 0 && (
                                <View style={styles.batchActionGroup}>
                                    <TouchableOpacity
                                        style={styles.batchMoveBtn}
                                        onPress={() => setIsBatchMovingOpen(true)}
                                    >
                                        <Text style={styles.batchMoveBtnText}>
                                            {`📁 선택 폴더 이동 (${selectedAlbumIds.size}개)`}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.batchRestoreBtn} onPress={handleBatchRestore}>
                                        <Text style={styles.batchRestoreBtnText}>
                                            {`📥 선택 일괄 복원 (${selectedAlbumIds.size}개)`}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.batchDeleteBtn} onPress={handleBatchDelete}>
                                        <Text style={styles.batchDeleteBtnText}>
                                            {`🗑️ 선택 영구 삭제 (${selectedAlbumIds.size}개)`}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {loading && (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator size="large" color="#0284C7" />
                                <Text style={styles.loadingText}>보관함 데이터를 처리하는 중...</Text>
                            </View>
                        )}

                        {!loading && fetchError && (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyIcon}>🔌</Text>
                                <Text style={styles.emptyTitle}>백엔드 서버에 연결할 수 없습니다.</Text>
                                <TouchableOpacity style={styles.retryBtn} onPress={fetchBackupData}>
                                    <Text style={styles.retryBtnText}>🔄 다시 시도</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!loading && !fetchError && filteredAlbums.length === 0 && (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyIcon}>📂</Text>
                                <Text style={styles.emptyTitle}>
                                    {searchKeyword
                                        ? `'${searchKeyword}'에 대한 검색 결과가 없습니다.`
                                        : `[${activeRootCategory}] 보관함에 앨범이 없습니다.`}
                                </Text>
                            </View>
                        )}

                        {!loading && !fetchError && filteredAlbums.length > 0 && (
                            <ScrollView style={styles.albumListScroll} contentContainerStyle={styles.albumListContent}>
                                {filteredAlbums.map((album) => {
                                    const isSelected = selectedAlbumIds.has(album.id);
                                    const isAlreadyPresent = isAlreadyInIndex(album);

                                    return (
                                        <View
                                            key={album.id}
                                            style={[styles.albumCard, isSelected && styles.albumCardSelected]}
                                        >
                                            <TouchableOpacity
                                                style={[styles.checkbox, isSelected && styles.checkboxActive]}
                                                onPress={() => {
                                                    setSelectedAlbumIds((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(album.id)) next.delete(album.id);
                                                        else next.add(album.id);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                <Text style={[styles.checkmark, isSelected && styles.checkmarkActive]}>
                                                    {isSelected ? '✓' : ''}
                                                </Text>
                                            </TouchableOpacity>

                                            <View style={styles.albumInfoWrapper}>
                                                <MouseDragHorizontalScroll contentContainerStyle={styles.thumbScroll}>
                                                    {album.imageUrls.map((mediaUrl, i) => {
                                                        const isVid = isVideoUrl(mediaUrl);

                                                        return (
                                                            <View key={i} style={styles.thumbContainer}>
                                                                {isVid && Platform.OS === 'web' ? (
                                                                    <div
                                                                        style={{
                                                                            width: 78,
                                                                            height: 60,
                                                                            position: 'relative',
                                                                            backgroundColor: '#000',
                                                                            borderRadius: 6,
                                                                            overflow: 'hidden',
                                                                        }}
                                                                    >
                                                                        <video
                                                                            src={mediaUrl}
                                                                            style={{
                                                                                width: '100%',
                                                                                height: '100%',
                                                                                objectFit: 'cover',
                                                                            }}
                                                                            muted
                                                                        />
                                                                        <div
                                                                            style={{
                                                                                position: 'absolute',
                                                                                inset: 0,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                backgroundColor: 'rgba(0,0,0,0.3)',
                                                                            }}
                                                                        >
                                                                            <span style={{ fontSize: 12 }}>🎬</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <Image
                                                                        source={{ uri: mediaUrl }}
                                                                        style={styles.thumbImg}
                                                                        resizeMode="cover"
                                                                    />
                                                                )}
                                                            </View>
                                                        );
                                                    })}
                                                </MouseDragHorizontalScroll>

                                                <View style={styles.metaRow}>
                                                    <View style={{ flex: 1 }}>
                                                        <View
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                flexWrap: 'wrap',
                                                            }}
                                                        >
                                                            <Text style={styles.albumTitle}>
                                                                {album.curatedNote?.title ||
                                                                    album.analysis?.title ||
                                                                    '추억의 순간'}
                                                            </Text>
                                                            <View style={styles.folderTag}>
                                                                <Text
                                                                    style={styles.folderTagText}
                                                                >{`📁 ${album.categoryFolder || '미분류'}`}</Text>
                                                            </View>
                                                            {album.history && album.history.length > 0 && (
                                                                <View style={styles.historyBadge}>
                                                                    <Text
                                                                        style={styles.historyBadgeText}
                                                                    >{`📜 버전 ${album.history.length}개 보관`}</Text>
                                                                </View>
                                                            )}
                                                            {isAlreadyPresent && (
                                                                <View style={styles.alreadyBadge}>
                                                                    <Text style={styles.alreadyBadgeText}>
                                                                        현재 홈에 존재함
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text style={styles.albumSub}>
                                                            {`📍 ${album.analysis?.location || '장소 미정'} · ⏳ ${album.analysis?.yearEstimate || '시기 미정'} · 🖼️ 미디어 ${album.imageUrls.length}개`}
                                                        </Text>
                                                    </View>

                                                    <View style={styles.cardBtnGroup}>
                                                        <TouchableOpacity
                                                            style={styles.renameFilesBtn}
                                                            onPress={() => {
                                                                setFileManagerAlbum(album);
                                                                setEditingTargetUrl(null);
                                                                setNewFileNameInput('');
                                                            }}
                                                        >
                                                            <Text style={styles.renameFilesBtnText}>
                                                                ✏️ 파일명 관리
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.moveFolderBtn}
                                                            onPress={() => setMovingAlbum(album)}
                                                        >
                                                            <Text style={styles.moveFolderBtnText}>📁 폴더 이동</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.detailBtn}
                                                            onPress={() => setViewingAlbum(album)}
                                                        >
                                                            <Text style={styles.detailBtnText}>👁️ 상세 보기</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[
                                                                styles.restoreSingleBtn,
                                                                isAlreadyPresent && styles.restoreSingleBtnDisabled,
                                                            ]}
                                                            onPress={() => handleRestoreSingle(album)}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.restoreSingleBtnText,
                                                                    isAlreadyPresent &&
                                                                        styles.restoreSingleBtnTextDisabled,
                                                                ]}
                                                            >
                                                                {isAlreadyPresent ? '✓ 홈에 있음' : '📥 홈으로 복원'}
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.deleteSingleBtn}
                                                            onPress={() => handleDeleteSingle(album.id)}
                                                        >
                                                            <Text style={styles.deleteSingleBtnText}>🗑️ 삭제</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </View>

                {/* 모달들 */}
                <CreateFolderModal
                    visible={isFolderModalOpen}
                    onClose={() => setIsFolderModalOpen(false)}
                    onCreate={handleCreateFolder}
                />

                <MoveFolderModal
                    visible={movingAlbum !== null}
                    title="📁 앨범 폴더 변경"
                    subtitle={`'${movingAlbum?.curatedNote?.title || movingAlbum?.analysis?.title}' 앨범을 이동할 [${activeRootCategory}] 폴더를 선택해주세요.`}
                    currentFolder={movingAlbum?.categoryFolder}
                    folders={currentSubFolders}
                    onClose={() => setMovingAlbum(null)}
                    onSelectFolder={(f) => movingAlbum && handleMoveAlbumToFolder(movingAlbum.id, f)}
                />

                <MoveFolderModal
                    visible={isBatchMovingOpen}
                    title="📁 선택한 앨범 일괄 폴더 이동"
                    subtitle={`선택한 ${selectedAlbumIds.size}개의 앨범을 일괄 이동할 [${activeRootCategory}] 대상 폴더를 선택해주세요.`}
                    folders={currentSubFolders}
                    onClose={() => setIsBatchMovingOpen(false)}
                    onSelectFolder={handleBatchMoveAlbumsToFolder}
                />

                <BackupDetailViewerModal
                    album={viewingAlbum}
                    isAlreadyInIndex={viewingAlbum ? isAlreadyInIndex(viewingAlbum) : false}
                    onClose={() => setViewingAlbum(null)}
                    onRestoreToHome={handleRestoreSingle}
                    onRollbackVersion={handleRollbackToHistoryVersion}
                    onDeleteHistoryVersion={handleDeleteHistoryFromBackup}
                />

                {/* 큰 폴더 이름 변경 모달 */}
                <Modal
                    visible={renameFolderModalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setRenameFolderModalOpen(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <Text style={styles.modalTitle}>📁 폴더 이름 변경</Text>
                            <Text style={styles.modalSubtitle}>현재 폴더명: '{targetFolderToRename}'</Text>

                            <TextInput
                                style={styles.modalInput}
                                value={newFolderNameInput}
                                onChangeText={setNewFolderNameInput}
                                placeholder="새로운 폴더명을 입력하세요"
                                placeholderTextColor="#94A3B8"
                                autoFocus
                            />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setRenameFolderModalOpen(false)}
                                >
                                    <Text style={styles.modalCancelBtnText}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirmRenameFolder}>
                                    <Text style={styles.modalConfirmBtnText}>변경 완료</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* 개별 사진 파일명 관리 모달 */}
                <Modal
                    visible={fileManagerAlbum !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => !isRenamingFile && setFileManagerAlbum(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.fileManagerModal}>
                            <View style={styles.modalHeaderRow}>
                                <View>
                                    <Text style={styles.modalTitle}>🖼️ 앨범 사진 파일명 관리</Text>
                                    <Text style={styles.modalSubtitle}>
                                        {fileManagerAlbum?.curatedNote?.title ||
                                            fileManagerAlbum?.analysis?.title ||
                                            '추억 앨범'}{' '}
                                        내부의 사진 파일명을 변경합니다.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.closeBtn}
                                    onPress={() => setFileManagerAlbum(null)}
                                    disabled={isRenamingFile}
                                >
                                    <Text style={styles.closeBtnText}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.fileListScroll} contentContainerStyle={{ gap: 10 }}>
                                {fileManagerAlbum?.imageUrls.map((imgUrl, idx) => {
                                    const rawFileName = imgUrl.split('/').pop() || `photo_${idx + 1}.jpg`;
                                    const dotIdx = rawFileName.lastIndexOf('.');
                                    const baseName = dotIdx !== -1 ? rawFileName.substring(0, dotIdx) : rawFileName;
                                    const isEditing = editingTargetUrl === imgUrl;

                                    return (
                                        <View key={idx} style={styles.fileRowItem}>
                                            <Image
                                                source={{ uri: imgUrl }}
                                                style={styles.fileRowThumb}
                                                resizeMode="cover"
                                            />

                                            <View style={{ flex: 1, paddingHorizontal: 10 }}>
                                                {isEditing ? (
                                                    <TextInput
                                                        style={styles.fileInlineInput}
                                                        value={newFileNameInput}
                                                        onChangeText={setNewFileNameInput}
                                                        placeholder="새 파일명 입력"
                                                        placeholderTextColor="#94A3B8"
                                                        autoFocus
                                                        editable={!isRenamingFile}
                                                    />
                                                ) : (
                                                    <Text
                                                        style={styles.fileRowName}
                                                        numberOfLines={1}
                                                        ellipsizeMode="middle"
                                                    >
                                                        📄 {rawFileName}
                                                    </Text>
                                                )}
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                {isEditing ? (
                                                    <>
                                                        <TouchableOpacity
                                                            style={styles.inlineCancelBtn}
                                                            onPress={() => {
                                                                setEditingTargetUrl(null);
                                                                setNewFileNameInput('');
                                                            }}
                                                            disabled={isRenamingFile}
                                                        >
                                                            <Text style={styles.inlineCancelText}>취소</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.inlineConfirmBtn}
                                                            onPress={() => handleExecuteRenameFile(imgUrl)}
                                                            disabled={isRenamingFile}
                                                        >
                                                            {isRenamingFile ? (
                                                                <ActivityIndicator size="small" color="#fff" />
                                                            ) : (
                                                                <Text style={styles.inlineConfirmText}>저장</Text>
                                                            )}
                                                        </TouchableOpacity>
                                                    </>
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.inlineEditBtn}
                                                        onPress={() => {
                                                            setEditingTargetUrl(imgUrl);
                                                            setNewFileNameInput(baseName);
                                                        }}
                                                    >
                                                        <Text style={styles.inlineEditText}>✏️ 이름 변경</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            <View style={styles.modalFooterRow}>
                                <TouchableOpacity
                                    style={styles.closeFooterBtn}
                                    onPress={() => setFileManagerAlbum(null)}
                                >
                                    <Text style={styles.closeFooterBtnText}>닫기</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    pageContainer: {
        flex: 1,
        backgroundColor: memoryColors.canvas,
    },
    modalCard: {
        flex: 1,
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        backgroundColor: memoryColors.canvas,
        paddingHorizontal: memoryLayout.desktopPadding,
        paddingTop: 28,
        paddingBottom: 32,
    },
    modalCardNarrow: {
        paddingHorizontal: memoryLayout.mobilePadding,
        paddingTop: 22,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 20,
    },
    backToHomeBtn: {
        minWidth: 230,
        minHeight: 40,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: memoryColors.brand,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    backToHomeBtnText: {
        color: memoryColors.surface,
        fontSize: 13,
        fontWeight: '700',
    },
    backupWorkspace: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 },
    backupWorkspaceNarrow: { flexDirection: 'column' },
    folderSidebar: {
        width: 272,
        flexShrink: 0,
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 16,
        padding: 24,
    },
    folderSidebarNarrow: { width: '100%' },
    sidebarTitle: {
        color: memoryColors.text,
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '700',
        marginBottom: 16,
    },
    albumArea: { flex: 1, minWidth: 0, minHeight: 0 },
    albumAreaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    albumAreaTitle: {
        color: memoryColors.text,
        fontSize: 20,
        lineHeight: 30,
        fontWeight: '700',
    },
    albumCountBadge: {
        color: memoryColors.textMuted,
        backgroundColor: memoryColors.subtle,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        fontSize: 12,
        overflow: 'hidden',
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        fontSize: 16,
        color: '#475569',
        fontWeight: '800',
        lineHeight: 18,
    },
    rootCategoryBar: {
        gap: 8,
        marginBottom: 16,
    },
    rootTabBtn: {
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: memoryColors.subtle,
        alignSelf: 'flex-start',
    },
    rootTabBtnActive: {
        backgroundColor: memoryColors.brandLight,
    },
    rootTabBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: memoryColors.textSecondary,
    },
    rootTabBtnTextActive: {
        color: memoryColors.brand,
        fontWeight: '700',
    },
    folderActionBar: {
        flexDirection: 'column',
        gap: 12,
        marginBottom: 14,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 40,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0F172A',
        outlineStyle: 'none' as any,
    },
    createFolderBtn: {
        width: '100%',
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        paddingHorizontal: 14,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    createFolderBtnText: {
        color: memoryColors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
    },
    folderTabWrapper: {
        paddingTop: 2,
    },
    folderList: { gap: 8 },
    folderTab: {
        width: '100%',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: memoryColors.subtle,
    },
    folderTabActive: { backgroundColor: memoryColors.brandLight },
    folderTabText: {
        fontSize: 12,
        color: memoryColors.textSecondary,
        fontWeight: '600',
    },
    folderTabTextActive: { color: memoryColors.brand, fontWeight: '700' },
    customFolderTabContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    folderRenameSmallBtn: {
        marginLeft: -8,
        marginRight: 2,
        backgroundColor: '#E0F2FE',
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    folderDeleteSmallBtn: {
        marginRight: 4,
        backgroundColor: '#FEE2E2',
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    toolbarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 8,
    },
    selectAllBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    selectAllBtnText: { fontSize: 12, color: '#475569', fontWeight: '700' },
    batchActionGroup: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    batchMoveBtn: {
        backgroundColor: '#0284C7',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    batchMoveBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
    batchRestoreBtn: {
        backgroundColor: '#0EA5E9',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    batchRestoreBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
    batchDeleteBtn: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    batchDeleteBtnText: { fontSize: 12, color: '#DC2626', fontWeight: '700' },
    loadingBox: { alignItems: 'center', marginVertical: 40 },
    loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
    emptyBox: { alignItems: 'center', marginVertical: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#475569' },
    retryBtn: {
        marginTop: 16,
        backgroundColor: '#0284C7',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    retryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    albumListScroll: { flex: 1 },
    albumListContent: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        paddingBottom: 20,
    },
    albumCard: {
        flexGrow: 1,
        flexBasis: 300,
        maxWidth: 520,
        minWidth: 280,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 16,
        padding: 16,
        backgroundColor: memoryColors.surface,
        gap: 12,
    },
    albumCardSelected: {
        borderColor: memoryColors.brand,
        backgroundColor: memoryColors.brandLight,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
    checkmark: { fontSize: 12, color: 'transparent', fontWeight: '800' },
    checkmarkActive: { color: '#FFFFFF' },
    albumInfoWrapper: { flex: 1, gap: 10 },
    thumbScroll: { flexDirection: 'row', gap: 10 },
    thumbContainer: {
        width: 78,
        height: 60,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
    },
    thumbImg: { width: 78, height: 60, borderRadius: 6 },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    albumTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    folderTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    folderTagText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    historyBadge: {
        backgroundColor: '#F3E8FF',
        borderWidth: 1,
        borderColor: '#E9D5FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    historyBadgeText: { fontSize: 11, color: '#7E22CE', fontWeight: '700' },
    alreadyBadge: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    alreadyBadgeText: { fontSize: 11, color: '#0369A1', fontWeight: '700' },
    albumSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    cardBtnGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    renameFilesBtn: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    renameFilesBtnText: { fontSize: 11, fontWeight: '700', color: '#0284C7' },
    moveFolderBtn: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
    },
    moveFolderBtnText: { fontSize: 11, fontWeight: '600', color: '#475569' },
    detailBtn: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    detailBtnText: { fontSize: 11, fontWeight: '600', color: '#475569' },
    restoreSingleBtn: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    restoreSingleBtnDisabled: { backgroundColor: '#E2E8F0' },
    restoreSingleBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
    restoreSingleBtnTextDisabled: { color: '#94A3B8' },
    deleteSingleBtn: {
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    deleteSingleBtnText: { fontSize: 11, fontWeight: '600', color: '#EF4444' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    modalSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
        marginBottom: 14,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#0F172A',
        backgroundColor: '#F8FAFC',
        marginBottom: 16,
    },
    modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    modalCancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
    },
    modalCancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    modalConfirmBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        backgroundColor: '#0284C7',
        minWidth: 80,
        alignItems: 'center',
    },
    modalConfirmBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    fileManagerModal: {
        width: '100%',
        maxWidth: 520,
        maxHeight: '80%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingBottom: 12,
        marginBottom: 12,
    },
    fileListScroll: { maxHeight: 360 },
    fileRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 8,
    },
    fileRowThumb: {
        width: 50,
        height: 42,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
    },
    fileRowName: { fontSize: 13, color: '#1E293B', fontWeight: '600' },
    fileInlineInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#0284C7',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 13,
        color: '#0F172A',
    },
    inlineEditBtn: {
        backgroundColor: '#E0F2FE',
        paddingVertical: 5,
        paddingHorizontal: 9,
        borderRadius: 6,
    },
    inlineEditText: { fontSize: 11, fontWeight: '700', color: '#0284C7' },
    inlineCancelBtn: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    inlineCancelText: { fontSize: 11, color: '#64748B' },
    inlineConfirmBtn: {
        backgroundColor: '#0284C7',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
        minWidth: 44,
        alignItems: 'center',
    },
    inlineConfirmText: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
    modalFooterRow: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 12,
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    closeFooterBtn: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 8,
    },
    closeFooterBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
});
