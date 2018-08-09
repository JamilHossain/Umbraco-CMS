﻿(function() {
    'use strict';

    /**
     * A component to manage file uploads for content properties
     * @param {any} $scope
     * @param {any} fileManager
     * @param {any} mediaHelper
     * @param {any} angularHelper
     */
    function umbPropertyFileUploadController($scope, $q, fileManager, mediaHelper, angularHelper) {

        //NOTE: this component supports multiple files, though currently the uploader does not but perhaps sometime in the future
        // we'd want it to, so i'll leave the multiple file support in place

        var vm = this;

        vm.$onInit = onInit;
        vm.$onChanges = onChanges;
        vm.$postLink = postLink;
        vm.clear = clearFiles;

        /** Clears the file collections when content is saving (if we need to clear) or after saved */
        function clearFiles() {
            //clear the files collection (we don't want to upload any!)
            fileManager.setFiles({
                propertyAlias: vm.propertyAlias,
                culture: vm.culture,
                files: []
            });
            //clear the current files
            vm.files = [];

            //notify the callback
            notifyValueChanged(null);
        }

        function notifyValueChanged(val, files) {

            if (!val) {
                val = null;
            }
            if (!files) {
                files = null;
            }

            //notify the callback
            vm.onValueChanged({ value: val, files: files });

            //need to explicity setDirty here to track changes
            vm.fileUploadForm.$setDirty();
        }

        function notifyInit(val, files) {
            if (!val) {
                val = null;
            }
            if (!files) {
                files = null;
            }

            if (vm.onInit) {
                vm.onInit({ value: val, files: files });
            }
        }

        /** Called when the component initializes */
        function onInit() {
            $scope.$on("filesSelected", onFilesSelected);
            initialize();
        }

        /** Called when the component has linked all elements, this is when the form controller is available */
        function postLink() {
            
        }

        function initialize() {

            //normalize culture to null if it's not there
            if (!vm.culture) {
                vm.culture = null;
            }

            //TODO: need to figure out what we can do for things like Nested Content

            //check the file manager to see if there's already local files pending for this editor
            var existingClientFiles = _.map(
                _.filter(fileManager.getFiles(),
                    function(f) {
                         return f.alias === vm.propertyAlias && f.culture === vm.culture;
                    }),
                function(f) {
                    return f.file;
                });

            //create the property to show the list of files currently saved
            if (existingClientFiles.length > 0) {
                updateModelFromSelectedFiles(existingClientFiles).then(function(newVal) {
                    //notify the callback
                    notifyInit(newVal, vm.files);
                });
            }
            else if (vm.value) {

                var files = vm.value.split(",");

                vm.files = _.map(files, function (file) {
                    var f = {
                        fileName: file,
                        isImage: mediaHelper.detectIfImageByExtension(file),
                        extension: getExtension(file)
                    };
                    f.fileSrc = getThumbnail(f);
                    return f;
                });

                //notify the callback
                notifyInit();
            }
            else {
                vm.files = [];

                //notify the callback
                notifyInit();
            }
        }

        ///** Method required by the valPropertyValidator directive (returns true if the property editor has at least one file selected) */
        //function validateMandatory() {
        //    return {
        //        isValid: !vm.validation.mandatory || (((vm.persistedFiles != null && vm.persistedFiles.length > 0) || (vm.files != null && vm.files.length > 0)) && !vm.clearFiles),
        //        errorMsg: "Value cannot be empty",
        //        errorKey: "required"
        //    };
        //}
        
        /**
         * Watch for model changes
         * @param {any} changes
         */
        function onChanges(changes) {

            if (changes.value && !changes.value.isFirstChange() && changes.value.currentValue !== changes.value.previousValue) {

                //if the value has been cleared, clear the files (ignore if the previous value is also falsy)
                if (!changes.value.currentValue && changes.value.previousValue) {
                    vm.files = [];
                }

                //// here we need to check if the value change needs to trigger an update in the UI.
                //// if the value is only changed in the controller and not in the server values, we do not
                //// want to trigger an update yet.
                //// we can however no longer rely on checking values in the controller vs. values from the server
                //// to determine whether to update or not, since you could potentially be uploading a file with
                //// the exact same name - in that case we need to reinitialize to show the newly uploaded file.
                //if (changes.value.currentValue.clearFiles !== true && !changes.value.currentValue.selectedFiles) {
                //    initialize(vm.rebuildInput.index + 1);
                //}
            }
        }

        function getThumbnail(file) {
            if (!file.isImage) {
                return null;
            }

            var thumbnailUrl = mediaHelper.getThumbnailFromPath(file.fileName);

            return thumbnailUrl;
        }

        function getExtension(fileName) {
            var extension = fileName.substring(fileName.lastIndexOf(".") + 1, fileName.length);
            return extension.toLowerCase();
        }

        /**
         * Updates the vm.files model from the selected files and returns a promise containing the csv of all file names selected
         * @param {any} files
         */
        function updateModelFromSelectedFiles(files) {

            //we return a promise because the FileReader api is async
            var promises = [];

            //clear the current files
            vm.files = [];
            var newVal = "";

            var reader = new FileReader();

            //for each file load in the contents from the file reader and set it as an fileSrc
            //property of the vm.files array item
            var fileCount = files.length;
            for (var i = 0; i < fileCount; i++) {
                var index = i; //capture

                var isImage = mediaHelper.detectIfImageByExtension(files[i].name);

                //save the file object to the files collection
                vm.files.push({
                    isImage: isImage,
                    extension: getExtension(files[i].name),
                    fileName: files[i].name,
                    isClientSide: true
                });

                newVal += files[i].name + ",";

                if (isImage) {

                    var deferred = $q.defer();

                    reader.onload = function(e) {
                        vm.files[index].fileSrc = e.target.result;
                        deferred.resolve(newVal);
                    };
                    promises.push(deferred.promise);
                    reader.readAsDataURL(files[i]);
                }
                else {
                    promises.push($q.when(newVal));
                }
            }

            return $q.all(promises).then(function (p) {
                //return the last value in the list of promises which will be the final value
                return $q.when(p[p.length - 1]);
            });
        }

        /**
         * listen for when a file is selected
         * @param {any} event
         * @param {any} args
         */
        function onFilesSelected(event, args) {

            if (args.files && args.files.length > 0) {

                //set the files collection
                fileManager.setFiles({
                    propertyAlias: vm.propertyAlias,
                    files: args.files,
                    culture: vm.culture
                });

                updateModelFromSelectedFiles(args.files).then(function(newVal) {
                    angularHelper.safeApply($scope,
                        function() {
                            //pass in the file names and the model files
                            notifyValueChanged(newVal, vm.files);
                        });
                });
            }
            else {
                angularHelper.safeApply($scope);
            }
        }

    };

    var umbPropertyFileUploadComponent = {
        templateUrl: 'views/components/upload/umb-property-file-upload.html',
        bindings: {
            culture: "@?",
            propertyAlias: "@",
            value: "<",
            hideSelection: "<",
            onValueChanged: "&",
            onInit: "&"
        },
        transclude: true,
        controllerAs: 'vm',
        controller: umbPropertyFileUploadController
    };

    angular.module("umbraco")
        .component('umbPropertyFileUpload', umbPropertyFileUploadComponent);

})();
